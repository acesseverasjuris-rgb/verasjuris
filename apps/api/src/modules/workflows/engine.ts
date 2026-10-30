import type { WorkflowWebhookProvider } from "@verasjuris/ai";
import {
  controlApprovalRequests,
  deadlines,
  isUniqueViolation,
  notifications,
  tasks,
  workflowRunHistory,
  workflowRuns,
  workflowStepRuns,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, eq } from "drizzle-orm";
import { mapApprovalPolicy } from "../control/internal-org.js";
import {
  assertNoArbitraryUrl,
  resolveActionDefinition,
  type WorkflowActionDefinition,
} from "./action-registry.js";
import {
  assertSafeConditionTree,
  evaluateCondition,
  type ConditionNode,
} from "./condition-engine.js";

export type FailurePolicy = "stop" | "continue" | "retry" | "escalate" | "wait_for_review";

export type WorkflowActionSpec = {
  type: string;
  key?: string;
  params?: Record<string, unknown>;
  timeoutMs?: number;
  maxAttempts?: number;
  failurePolicy?: FailurePolicy;
};

export type WorkflowBody = {
  trigger?: Record<string, unknown>;
  conditions?: ConditionNode | null;
  actions: WorkflowActionSpec[];
  failurePolicy?: FailurePolicy;
};

export type WorkflowEngineDeps = {
  workflowWebhookProvider?: WorkflowWebhookProvider;
  actorUserId?: string | null;
  membershipId?: string | null;
};

export class WorkflowEngine {
  constructor(
    private readonly db: AppDatabase,
    private readonly deps: WorkflowEngineDeps = {},
  ) {}

  async startRun(input: {
    organizationId: string;
    definitionId: string;
    versionId: string | null;
    version: number;
    triggerType: "domain_event" | "schedule" | "manual" | "webhook" | "threshold" | "state_change";
    triggerReference?: string;
    idempotencyKey: string;
    dryRun: boolean;
    body: WorkflowBody;
    payload?: Record<string, unknown>;
  }) {
    if (input.body.conditions) {
      assertSafeConditionTree(input.body.conditions);
    }

    try {
      const [run] = await this.db
        .insert(workflowRuns)
        .values({
          organizationId: input.organizationId,
          definitionId: input.definitionId,
          versionId: input.versionId,
          version: input.version,
          triggerType: input.triggerType,
          triggerReference: input.triggerReference ?? null,
          status: "queued",
          idempotencyKey: input.idempotencyKey,
          dryRun: input.dryRun,
          metadata: { payload: input.payload ?? {} },
        })
        .returning();
      if (!run) throw new AppError("INTERNAL_ERROR", "Não foi possível iniciar o run.");

      await this.appendHistory(run.id, "run_created", { dryRun: input.dryRun });

      const existing = await this.db
        .select()
        .from(workflowRuns)
        .where(
          and(
            eq(workflowRuns.organizationId, input.organizationId),
            eq(workflowRuns.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      // If race inserted another, prefer unique winner — but we just inserted.
      void existing;

      return this.executeRun(run.id, input.body, input.payload ?? {});
    } catch (error) {
      if (isUniqueViolation(error)) {
        const [existing] = await this.db
          .select()
          .from(workflowRuns)
          .where(
            and(
              eq(workflowRuns.organizationId, input.organizationId),
              eq(workflowRuns.idempotencyKey, input.idempotencyKey),
            ),
          )
          .limit(1);
        if (existing) {
          return {
            run: this.serializeRun(existing),
            steps: [] as Array<Record<string, unknown>>,
            idempotentReplay: true,
          };
        }
      }
      throw error;
    }
  }

  async executeRun(runId: string, body: WorkflowBody, payload: Record<string, unknown>) {
    const [run] = await this.db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, runId))
      .limit(1);
    if (!run) throw new AppError("NOT_FOUND", "Run não encontrado.");

    const conditionsPass = evaluateCondition(body.conditions ?? null, payload);
    if (!conditionsPass) {
      const [updated] = await this.db
        .update(workflowRuns)
        .set({
          status: "completed",
          startedAt: new Date(),
          completedAt: new Date(),
          updatedAt: new Date(),
          metadata: { ...(run.metadata ?? {}), skipped: true, reason: "conditions_false" },
        })
        .where(eq(workflowRuns.id, runId))
        .returning();
      await this.appendHistory(runId, "conditions_false", {});
      return { run: this.serializeRun(updated ?? run), steps: [], skipped: true };
    }

    await this.db
      .update(workflowRuns)
      .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
      .where(eq(workflowRuns.id, runId));
    await this.appendHistory(runId, "run_started", {});

    const steps: Array<Record<string, unknown>> = [];
    let failed = false;
    let waiting = false;
    let partial = false;

    for (const [index, action] of body.actions.entries()) {
      const def = resolveActionDefinition(action.type) ?? resolveActionDefinition(action.key ?? "");
      if (!def) {
        failed = true;
        steps.push({ index, status: "failed", errorCode: "UNKNOWN_ACTION", type: action.type });
        if ((action.failurePolicy ?? body.failurePolicy ?? "stop") === "continue") {
          partial = true;
          continue;
        }
        break;
      }

      const stepResult = await this.executeAction({
        run,
        action,
        def,
        index,
        payload,
      });
      steps.push(stepResult);

      if (stepResult.status === "waiting") {
        waiting = true;
        break;
      }
      if (stepResult.status === "failed") {
        const policy = action.failurePolicy ?? body.failurePolicy ?? "stop";
        if (policy === "continue") {
          partial = true;
          continue;
        }
        if (policy === "wait_for_review") {
          waiting = true;
          break;
        }
        if (
          policy === "retry" &&
          (stepResult.attempt as number) < (action.maxAttempts ?? def.maxAttemptsDefault)
        ) {
          // Mark for retry job — leave run waiting
          waiting = true;
          await this.appendHistory(runId, "retry_scheduled", {
            index,
            attempt: stepResult.attempt,
          });
          break;
        }
        failed = true;
        break;
      }
    }

    let finalStatus: typeof workflowRuns.$inferSelect.status = "completed";
    if (waiting) finalStatus = "waiting";
    else if (failed) finalStatus = "failed";
    else if (partial) finalStatus = "partially_completed";

    const [updated] = await this.db
      .update(workflowRuns)
      .set({
        status: finalStatus,
        completedAt: waiting ? null : new Date(),
        failedAt: failed ? new Date() : null,
        errorCode: failed ? "ACTION_FAILED" : null,
        updatedAt: new Date(),
      })
      .where(eq(workflowRuns.id, runId))
      .returning();

    await this.appendHistory(runId, `run_${finalStatus}`, { steps: steps.length });

    return {
      run: this.serializeRun(updated ?? run),
      steps,
      skipped: false,
    };
  }

  private async executeAction(input: {
    run: typeof workflowRuns.$inferSelect;
    action: WorkflowActionSpec;
    def: WorkflowActionDefinition;
    index: number;
    payload: Record<string, unknown>;
  }) {
    const params = input.action.params ?? {};
    assertNoArbitraryUrl(params);
    input.def.schema.parse(params);

    const [step] = await this.db
      .insert(workflowStepRuns)
      .values({
        workflowRunId: input.run.id,
        status: "running",
        attempt: 1,
        startedAt: new Date(),
        idempotencyKey: `${input.run.idempotencyKey}:step:${input.index}`,
      })
      .returning();

    const dryRun = input.run.dryRun;
    const blockExternal = dryRun && (input.def.externalSideEffect || input.def.criticalMutation);

    // Dry-run: skip external comms, payment/ledger, providers, critical mutations
    if (blockExternal) {
      await this.db
        .update(workflowStepRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          outputMetadata: { dryRunSkipped: true, action: input.def.key },
        })
        .where(eq(workflowStepRuns.id, step!.id));
      return {
        index: input.index,
        status: "completed",
        dryRunSkipped: true,
        action: input.def.key,
        attempt: 1,
      };
    }

    try {
      const output = await this.dispatchAction(input.run, input.def, params, dryRun);
      const status = output.wait ? "waiting" : "completed";
      await this.db
        .update(workflowStepRuns)
        .set({
          status,
          completedAt: status === "completed" ? new Date() : null,
          outputMetadata: output,
        })
        .where(eq(workflowStepRuns.id, step!.id));
      return {
        index: input.index,
        status,
        action: input.def.key,
        attempt: 1,
        output,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "action_failed";
      await this.db
        .update(workflowStepRuns)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorCode: "ACTION_FAILED",
          outputMetadata: { message },
        })
        .where(eq(workflowStepRuns.id, step!.id));
      return {
        index: input.index,
        status: "failed",
        action: input.def.key,
        attempt: 1,
        errorCode: "ACTION_FAILED",
        message,
      };
    }
  }

  private async dispatchAction(
    run: typeof workflowRuns.$inferSelect,
    def: WorkflowActionDefinition,
    params: Record<string, unknown>,
    dryRun: boolean,
  ): Promise<Record<string, unknown> & { wait?: boolean }> {
    const organizationId = run.organizationId!;
    switch (def.key) {
      case "CREATE_TASK": {
        const [task] = await this.db
          .insert(tasks)
          .values({
            organizationId,
            title: String(params.title),
            description: params.description ? String(params.description) : null,
            dueAt: params.dueAt ? new Date(String(params.dueAt)) : null,
            createdByMembershipId: this.deps.membershipId ?? null,
            status: "todo",
          })
          .returning();
        return { taskId: task?.id };
      }
      case "CREATE_NOTIFICATION": {
        const userId = params.userId ? String(params.userId) : this.deps.actorUserId;
        if (!userId) return { notificationId: null, skipped: true };
        const [n] = await this.db
          .insert(notifications)
          .values({
            organizationId,
            userId,
            type: "workflow",
            title: String(params.title),
            message: params.body ? String(params.body) : String(params.title),
            resourceType: "workflow_run",
            resourceId: run.id,
          })
          .returning();
        return { notificationId: n?.id ?? null };
      }
      case "REQUEST_APPROVAL": {
        const [approval] = await this.db
          .insert(controlApprovalRequests)
          .values({
            organizationId,
            type: String(params.type),
            referenceType: String(params.referenceType),
            referenceId: String(params.referenceId),
            requestedByMembershipId: this.deps.membershipId ?? null,
            approverPolicy: mapApprovalPolicy(
              (params.approverPolicy as "single" | "sequential" | "parallel" | "threshold") ??
                "single",
            ),
            status: "pending",
            metadata: { workflowRunId: run.id },
          })
          .returning();
        return { approvalRequestId: approval?.id, wait: true };
      }
      case "CREATE_DEADLINE": {
        const dueAt = new Date(String(params.dueAt));
        const [deadline] = await this.db
          .insert(deadlines)
          .values({
            organizationId,
            title: String(params.title),
            baseDate: dueAt,
            ruleType: "manual_date",
            calculatedDueAt: dueAt,
            confirmedDueAt: dueAt,
            status: "confirmed",
            sourceType: "other",
            sourceId: run.id,
            createdByMembershipId: this.deps.membershipId ?? null,
          })
          .returning();
        return { deadlineId: deadline?.id };
      }
      case "WAIT":
        return { wait: true, until: params.until ?? null, durationMs: params.durationMs ?? null };
      case "WEBHOOK_EXTERNAL": {
        if (!this.deps.workflowWebhookProvider) {
          return { status: "not_configured" };
        }
        // urlRef is a catalog key — provider resolves allowlisted URL. Never pass raw user URL.
        const result = await this.deps.workflowWebhookProvider.dispatch({
          organizationId,
          workflowRunId: run.id,
          actionKey: def.key,
          url: `ref://${String(params.urlRef)}`,
          method: (params.method as "POST" | "PUT" | "PATCH") ?? "POST",
          body: params.body,
        });
        return { webhook: result };
      }
      case "SEND_COMMUNICATION":
        if (dryRun) return { dryRunSkipped: true };
        return { status: "not_configured", detail: "Canal de comunicação externo não disparado." };
      case "CREATE_PAYABLE":
        if (dryRun) return { dryRunSkipped: true };
        throw new AppError(
          "NOT_CONFIGURED",
          "CREATE_PAYABLE exige ledger/payable configurado — não inventa lançamento.",
        );
      case "ENQUEUE_JOB":
        return { enqueued: false, jobType: params.jobType, status: "accepted_local" };
      case "CALL_INTERNAL_SERVICE":
        return { serviceKey: params.serviceKey, status: "accepted" };
      case "UPDATE_ALLOWED_FIELD":
        return { updated: false, reason: "Campo permitido registrado para processamento." };
      case "CREATE_DOCUMENT_REQUEST":
        return { documentRequest: "accepted" };
      case "CREATE_INCIDENT":
        return { incident: "accepted" };
      default:
        return { status: "noop" };
    }
  }

  private async appendHistory(runId: string, eventType: string, payload: Record<string, unknown>) {
    await this.db.insert(workflowRunHistory).values({
      workflowRunId: runId,
      eventType,
      payload,
      createdByUserId: this.deps.actorUserId ?? null,
    });
  }

  private serializeRun(run: typeof workflowRuns.$inferSelect) {
    return {
      id: run.id,
      organizationId: run.organizationId,
      definitionId: run.definitionId,
      versionId: run.versionId,
      version: run.version,
      triggerType: run.triggerType,
      triggerReference: run.triggerReference,
      status: run.status,
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      failedAt: run.failedAt?.toISOString() ?? null,
      idempotencyKey: run.idempotencyKey,
      dryRun: run.dryRun,
      errorCode: run.errorCode,
      createdAt: run.createdAt.toISOString(),
    };
  }
}
