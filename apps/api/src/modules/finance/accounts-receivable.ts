import { invoices, receivables, isUniqueViolation, type AppDatabase } from "@verasjuris/database";
import { and, eq, inArray, sql } from "drizzle-orm";

const OPEN_STATUSES = ["open", "partially_paid", "past_due"] as const;

function receivableStatusFromInvoice(
  status: (typeof invoices.$inferSelect)["status"],
  dueAt: Date | null,
  amountDueCents: number,
  now: number,
): (typeof receivables.$inferInsert)["status"] {
  if (status === "paid") return "paid";
  if (status === "void" || status === "uncollectible") return "cancelled";
  if (status === "refunded") return "cancelled";
  if (status === "partially_paid") {
    if (dueAt && dueAt.getTime() < now && amountDueCents > 0) return "overdue";
    return "partial";
  }
  if (status === "past_due" || (dueAt && dueAt.getTime() < now && amountDueCents > 0)) {
    return "overdue";
  }
  return "open";
}

/**
 * Projeção de contas a receber a partir de invoices — não é saldo de ledger.
 * Também sincroniza a tabela `receivables` (projection store) de forma idempotente.
 */
export class AccountsReceivableService {
  constructor(private readonly db: AppDatabase) {}

  async project(organizationId: string, currency = "BRL") {
    const rows = await this.db.query.invoices.findMany({
      where: and(
        eq(invoices.organizationId, organizationId),
        eq(invoices.currency, currency),
        inArray(invoices.status, [...OPEN_STATUSES]),
      ),
      orderBy: (t, { asc }) => [asc(t.dueAt), asc(t.createdAt)],
    });

    const now = Date.now();
    let openCents = 0;
    let pastDueCents = 0;
    let partiallyPaidCents = 0;

    const items = rows.map((row) => {
      const due = row.amountDueCents;
      openCents += due;
      if (row.status === "past_due" || (row.dueAt && row.dueAt.getTime() < now && due > 0)) {
        pastDueCents += due;
      }
      if (row.status === "partially_paid") {
        partiallyPaidCents += due;
      }
      return {
        invoiceId: row.id,
        invoiceNumber: row.invoiceNumber,
        status: row.status,
        currency: row.currency,
        totalCents: row.totalCents,
        amountPaidCents: row.amountPaidCents,
        amountDueCents: row.amountDueCents,
        dueAt: row.dueAt?.toISOString() ?? null,
        clientId: row.clientId,
        subscriptionId: row.subscriptionId,
      };
    });

    return {
      currency,
      openInvoiceCount: rows.length,
      openCents,
      pastDueCents,
      partiallyPaidCents,
      items,
      /** Explicit: this projection is not a bank/ledger cash balance. */
      kind: "receivables_projection" as const,
      notLedgerBalance: true,
    };
  }

  /**
   * Upsert receivables rows from open/paid invoices for treasury delinquency & forecast.
   * Idempotent on (organizationId, sourceType=invoice, sourceId).
   */
  async syncFromInvoices(organizationId: string, currency = "BRL") {
    const rows = await this.db.query.invoices.findMany({
      where: and(eq(invoices.organizationId, organizationId), eq(invoices.currency, currency)),
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    });
    const now = Date.now();
    let upserted = 0;

    for (const invoice of rows) {
      if (invoice.status === "draft") continue;
      const status = receivableStatusFromInvoice(
        invoice.status,
        invoice.dueAt,
        invoice.amountDueCents,
        now,
      );
      const values = {
        organizationId,
        sourceType: "invoice",
        sourceId: invoice.id,
        debtorType: invoice.clientId ? "client" : invoice.userId ? "user" : "organization",
        debtorId: invoice.clientId ?? invoice.userId ?? organizationId,
        amountCents: invoice.totalCents,
        amountPaidCents: invoice.amountPaidCents,
        currency: invoice.currency,
        dueAt: invoice.dueAt,
        expectedAt: invoice.dueAt,
        status,
        updatedAt: new Date(),
      };

      try {
        await this.db
          .insert(receivables)
          .values(values)
          .onConflictDoUpdate({
            target: [receivables.organizationId, receivables.sourceType, receivables.sourceId],
            set: {
              amountCents: values.amountCents,
              amountPaidCents: values.amountPaidCents,
              dueAt: values.dueAt,
              expectedAt: values.expectedAt,
              status: values.status,
              debtorType: values.debtorType,
              debtorId: values.debtorId,
              updatedAt: values.updatedAt,
            },
          });
        upserted += 1;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }

    const projected = await this.listReceivables(organizationId, { currency });
    return { upserted, ...projected };
  }

  async listReceivables(
    organizationId: string,
    query: {
      currency?: string;
      status?: (typeof receivables.$inferSelect)["status"];
      sourceType?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const filters = [eq(receivables.organizationId, organizationId)];
    if (query.currency) filters.push(eq(receivables.currency, query.currency));
    if (query.status) filters.push(eq(receivables.status, query.status));
    if (query.sourceType) filters.push(eq(receivables.sourceType, query.sourceType));

    const rows = await this.db.query.receivables.findMany({
      where: and(...filters),
      orderBy: (t, { asc }) => [asc(t.dueAt), asc(t.createdAt)],
      limit: query.limit ?? 100,
      offset: query.offset ?? 0,
    });

    const openStatuses = new Set(["open", "partial", "overdue"]);
    let openCents = 0;
    let overdueCents = 0;
    for (const row of rows) {
      const due = Math.max(0, row.amountCents - row.amountPaidCents);
      if (openStatuses.has(row.status)) openCents += due;
      if (row.status === "overdue") overdueCents += due;
    }

    return {
      currency: query.currency ?? "BRL",
      openCents,
      overdueCents,
      count: rows.length,
      items: rows.map((row) => ({
        id: row.id,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        debtorType: row.debtorType,
        debtorId: row.debtorId,
        amountCents: row.amountCents,
        amountPaidCents: row.amountPaidCents,
        amountDueCents: Math.max(0, row.amountCents - row.amountPaidCents),
        currency: row.currency,
        dueAt: row.dueAt?.toISOString() ?? null,
        expectedAt: row.expectedAt?.toISOString() ?? null,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      kind: "receivables_table" as const,
      notLedgerBalance: true,
    };
  }

  async summaryByStatus(organizationId: string) {
    const rows = await this.db
      .select({
        status: invoices.status,
        count: sql<string>`count(*)::text`,
        totalDueCents: sql<string>`coalesce(sum(${invoices.amountDueCents}), 0)::text`,
        totalPaidCents: sql<string>`coalesce(sum(${invoices.amountPaidCents}), 0)::text`,
      })
      .from(invoices)
      .where(eq(invoices.organizationId, organizationId))
      .groupBy(invoices.status);

    return rows.map((row) => ({
      status: row.status,
      count: Number(row.count),
      totalDueCents: Number(row.totalDueCents),
      totalPaidCents: Number(row.totalPaidCents),
    }));
  }
}
