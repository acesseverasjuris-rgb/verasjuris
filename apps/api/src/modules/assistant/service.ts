import type { AIGateway } from "@verasjuris/ai";
import type { SessionAccount } from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import { assistantConversations, assistantFeedback, assistantMessages } from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq } from "drizzle-orm";
import { requireOrganizationPermission } from "../auth/routes.js";
import {
  assertNoCriticalAutonomousAction,
  assertToolAllowed,
  FAQ_FALLBACK,
  systemPromptForLocale,
  type AssistantToolName,
} from "./tool-registry.js";

export class AssistantService {
  constructor(
    private readonly db: AppDatabase,
    private readonly aiGateway?: AIGateway | null,
  ) {}

  async createConversation(
    account: SessionAccount,
    input: { title?: string; locale?: string; organizationId?: string },
  ) {
    if (input.organizationId) {
      requireOrganizationPermission(account, input.organizationId, "assistant.use");
    }
    const locale = input.locale ?? account.user.locale ?? "pt-BR";
    const [row] = await this.db
      .insert(assistantConversations)
      .values({
        userId: account.user.id,
        organizationId: input.organizationId ?? null,
        title: input.title ?? null,
        locale,
        status: "active",
      })
      .returning();
    await this.db.insert(assistantMessages).values({
      conversationId: row!.id,
      role: "system",
      content: systemPromptForLocale(locale),
      providerKey: "system",
    });
    return { conversation: row };
  }

  async listConversations(account: SessionAccount, organizationId?: string) {
    const items = await this.db.query.assistantConversations.findMany({
      where: organizationId
        ? and(
            eq(assistantConversations.userId, account.user.id),
            eq(assistantConversations.organizationId, organizationId),
          )
        : eq(assistantConversations.userId, account.user.id),
      orderBy: [desc(assistantConversations.updatedAt)],
      limit: 50,
    });
    return { items };
  }

  async sendMessage(
    account: SessionAccount,
    input: {
      sessionId: string;
      content: string;
      requestCriticalAction?: boolean;
      criticalActionKey?: string;
    },
  ) {
    const conversation = await this.requireOwnedConversation(account, input.sessionId);
    assertNoCriticalAutonomousAction(input.content, Boolean(input.requestCriticalAction));

    await this.db.insert(assistantMessages).values({
      conversationId: conversation.id,
      role: "user",
      content: input.content,
      providerKey: "user",
    });

    const locale = conversation.locale || "pt-BR";
    let replyText: string;
    let providerKey = "faq_fallback";

    if (this.aiGateway) {
      try {
        const health = await this.aiGateway.healthCheck();
        if (health.status === "not_configured") {
          replyText = this.faqReply(locale, input.content);
          providerKey = "faq_fallback";
        } else if (conversation.organizationId) {
          const result = await this.aiGateway.generateText({
            userId: account.user.id,
            organizationId: conversation.organizationId,
            feature: "education.question_answering",
            promptVersion: "assistant-v1",
            instructions: systemPromptForLocale(locale),
            input: input.content,
          });
          replyText = result.data;
          providerKey = result.provider || "ai";
        } else {
          replyText = this.faqReply(locale, input.content);
          providerKey = "faq_fallback";
        }
      } catch {
        replyText = this.faqReply(locale, input.content);
        providerKey = "faq_fallback";
      }
    } else {
      replyText = this.faqReply(locale, input.content);
    }

    const [assistantMsg] = await this.db
      .insert(assistantMessages)
      .values({
        conversationId: conversation.id,
        role: "assistant",
        content: replyText,
        providerKey,
      })
      .returning();

    await this.db
      .update(assistantConversations)
      .set({ updatedAt: new Date() })
      .where(eq(assistantConversations.id, conversation.id));

    return {
      message: assistantMsg,
      providerKey,
      tools: [
        "searchHelp",
        "navigateTo",
        "createSupportRequest",
        "listMatters",
        "listDeadlines",
        "listDocuments",
      ],
    };
  }

  async invokeTool(
    account: SessionAccount,
    conversationId: string,
    tool: AssistantToolName,
    params: Record<string, unknown> = {},
  ) {
    const conversation = await this.requireOwnedConversation(account, conversationId);
    assertToolAllowed(account, conversation.organizationId, tool);
    if (tool === "createSupportRequest") {
      const ticket = {
        id: cryptoRandom(),
        subject: String(params.subject ?? "Suporte assistente"),
        status: "open",
        organizationId: conversation.organizationId,
      };
      await this.db.insert(assistantMessages).values({
        conversationId,
        role: "tool",
        content: JSON.stringify({ tool, ticket }),
        providerKey: "tool",
      });
      return { result: ticket };
    }
    if (tool === "searchHelp") {
      return { result: this.faqReply(conversation.locale, String(params.q ?? "")) };
    }
    if (tool === "navigateTo") {
      return { result: { path: String(params.path ?? "/app"), allowed: true } };
    }
    return {
      result: { tool, items: [], note: "Lista filtrada por permissão; dados via domínio fonte." },
    };
  }

  async feedback(
    account: SessionAccount,
    input: {
      conversationId?: string;
      messageId?: string;
      rating: "positive" | "negative" | "neutral";
      comment?: string;
    },
  ) {
    const [row] = await this.db
      .insert(assistantFeedback)
      .values({
        conversationId: input.conversationId ?? null,
        messageId: input.messageId ?? null,
        userId: account.user.id,
        rating: input.rating,
        comment: input.comment ?? null,
      })
      .returning();
    return { feedback: row };
  }

  private faqReply(locale: string, content: string): string {
    const lang = locale.toLowerCase().startsWith("en") ? "en" : "pt-BR";
    const faqs = FAQ_FALLBACK[lang] ?? FAQ_FALLBACK["pt-BR"]!;
    const hit = faqs.find((f) =>
      content
        .toLowerCase()
        .split(/\s+/)
        .some((w) => w.length > 3 && f.toLowerCase().includes(w)),
    );
    return hit ?? faqs[0]!;
  }

  private async requireOwnedConversation(account: SessionAccount, id: string) {
    const row = await this.db.query.assistantConversations.findFirst({
      where: and(
        eq(assistantConversations.id, id),
        eq(assistantConversations.userId, account.user.id),
      ),
    });
    if (!row || row.status === "deleted") {
      throw new AppError("NOT_FOUND", "Conversa do assistente não encontrada.");
    }
    if (row.organizationId) {
      const membership = account.memberships.find((m) => m.organizationId === row.organizationId);
      if (!membership) {
        throw new AppError("AUTHORIZATION_ERROR", "Conversa pertence a outra organização.");
      }
    }
    return row;
  }
}

function cryptoRandom(): string {
  return `sup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
