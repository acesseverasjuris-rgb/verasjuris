import { AppError } from "@verasjuris/types";

/**
 * Issue tracker externo (GitHub Issues / Jira / Linear).
 * Default: not_configured — nunca finge issue criada ou sincronizada.
 */

export type IssueTrackerProviderKind = "github" | "jira" | "linear" | "other" | "not_configured";

export type IssueTrackerHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type IssueTrackerIssueStatus =
  | "open"
  | "in_progress"
  | "blocked"
  | "done"
  | "cancelled"
  | "unknown"
  | "not_configured";

export type CreateExternalIssueInput = {
  organizationId?: string;
  title: string;
  description?: string;
  labels?: readonly string[];
  projectKey?: string;
  priority?: string;
  signal?: AbortSignal;
};

export type ExternalIssueRecord = {
  providerKey: string;
  kind: IssueTrackerProviderKind;
  status: IssueTrackerIssueStatus;
  externalIssueId: string | null;
  externalUrl: string | null;
  title: string;
  detail?: string;
};

export type GetExternalIssueInput = {
  organizationId?: string;
  externalIssueId: string;
  signal?: AbortSignal;
};

export type ListExternalIssuesInput = {
  organizationId?: string;
  projectKey?: string;
  status?: string;
  signal?: AbortSignal;
};

export type ExternalIssuesPage = {
  providerKey: string;
  kind: IssueTrackerProviderKind;
  status: "ok" | "unavailable" | "not_configured";
  issues: readonly ExternalIssueRecord[];
  nextCursor?: string | null;
};

export interface IssueTrackerProvider {
  readonly id: string;
  readonly kind: IssueTrackerProviderKind;
  createIssue(input: CreateExternalIssueInput): Promise<ExternalIssueRecord>;
  getIssue(input: GetExternalIssueInput): Promise<ExternalIssueRecord>;
  listIssues(input: ListExternalIssuesInput): Promise<ExternalIssuesPage>;
  healthCheck(): Promise<IssueTrackerHealth>;
}

const MESSAGE =
  "Nenhum provedor de issue tracker (GitHub/Jira/Linear) está configurado. Bugs e roadmap permanecem internos.";

export class NotConfiguredIssueTrackerProvider implements IssueTrackerProvider {
  readonly id = "not_configured";
  readonly kind = "not_configured" as const;

  createIssue(input: CreateExternalIssueInput): Promise<ExternalIssueRecord> {
    return Promise.resolve({
      providerKey: "not_configured",
      kind: "not_configured",
      status: "not_configured",
      externalIssueId: null,
      externalUrl: null,
      title: input.title,
      detail: MESSAGE,
    });
  }

  getIssue(_input: GetExternalIssueInput): Promise<ExternalIssueRecord> {
    return Promise.resolve({
      providerKey: "not_configured",
      kind: "not_configured",
      status: "not_configured",
      externalIssueId: null,
      externalUrl: null,
      title: "",
      detail: MESSAGE,
    });
  }

  listIssues(_input: ListExternalIssuesInput): Promise<ExternalIssuesPage> {
    return Promise.resolve({
      providerKey: "not_configured",
      kind: "not_configured",
      status: "not_configured",
      issues: [],
      nextCursor: null,
    });
  }

  healthCheck(): Promise<IssueTrackerHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function issueTrackerProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
