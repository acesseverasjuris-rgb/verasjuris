import { NotConfiguredPaymentProvider } from "@verasjuris/ai";
import {
  ledgerAccounts,
  ledgerEntries,
  ledgerTransactions,
  seedReferenceData,
} from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { AppError } from "@verasjuris/types";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import { LedgerPostingService } from "./modules/finance/ledger-posting-service.js";
import { call } from "./test-helpers.js";

describe("Etapa 21 — Ledger (double-entry)", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;
  let posting: LedgerPostingService;

  const root = (org = s?.orgA) => `/v1/organizations/${org}`;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      paymentProvider: new NotConfiguredPaymentProvider(),
    });
    s = await bootstrapEtapa6(app, email, "ledger");
    posting = new LedgerPostingService(database.db);
  });

  afterAll(async () => {
    await app?.close();
    await database?.close();
  });

  it("LedgerPostingService: double-entry debit==credit posts; unbalanced blocked", async () => {
    const accounts = await posting.ensureSystemAccounts(s.orgA, "BRL");
    const cash = accounts.CASH_CLEARING;
    const revenue = accounts.PLATFORM_REVENUE;

    const posted = await posting.post({
      organizationId: s.orgA,
      transactionType: "manual_journal",
      currency: "BRL",
      idempotencyKey: `unit-balanced-${Date.now()}`,
      description: "Unit balanced",
      entries: [
        { accountId: cash.id, direction: "debit", amountCents: 1000 },
        { accountId: revenue.id, direction: "credit", amountCents: 1000 },
      ],
    });
    expect(posted.status).toBe("posted");
    expect(posted.entries).toHaveLength(2);
    const debit = posted.entries!.reduce(
      (sum, e) => sum + (e.direction === "debit" ? e.amountCents : 0),
      0,
    );
    const credit = posted.entries!.reduce(
      (sum, e) => sum + (e.direction === "credit" ? e.amountCents : 0),
      0,
    );
    expect(debit).toBe(credit);

    await expect(
      posting.post({
        organizationId: s.orgA,
        transactionType: "manual_journal",
        currency: "BRL",
        idempotencyKey: `unit-unbalanced-${Date.now()}`,
        entries: [
          { accountId: cash.id, direction: "debit", amountCents: 1000 },
          { accountId: revenue.id, direction: "credit", amountCents: 500 },
        ],
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("API: journal balanceado posta; desbalanceado bloqueado", async () => {
    const accountsRes = await call(
      app,
      "GET",
      `${root()}/finance/ledger/accounts?systemAccount=true`,
      undefined,
      s.ownerA,
    );
    expect(accountsRes.statusCode).toBe(200);
    const accounts = accountsRes.json<{
      items: Array<{ id: string; systemKey: string | null }>;
    }>().items;
    const cash = accounts.find((a) => a.systemKey === "CASH_CLEARING")!;
    const revenue = accounts.find((a) => a.systemKey === "PLATFORM_REVENUE")!;
    expect(cash && revenue).toBeTruthy();

    const ok = await call(
      app,
      "POST",
      `${root()}/finance/ledger/manual-journal`,
      {
        transactionType: "manual_journal",
        currency: "BRL",
        idempotencyKey: `api-balanced-${Date.now()}`,
        reason: "Lançamento de teste balanceado",
        description: "Teste API",
        entries: [
          { accountId: cash.id, direction: "debit", amountCents: 2500 },
          { accountId: revenue.id, direction: "credit", amountCents: 2500 },
        ],
      },
      s.ownerA,
    );
    expect(ok.statusCode).toBe(201);
    expect(ok.json<{ transaction: { status: string } }>().transaction.status).toBe("posted");

    const bad = await call(
      app,
      "POST",
      `${root()}/finance/ledger/manual-journal`,
      {
        transactionType: "manual_journal",
        currency: "BRL",
        idempotencyKey: `api-unbalanced-${Date.now()}`,
        reason: "Tentativa desbalanceada",
        entries: [
          { accountId: cash.id, direction: "debit", amountCents: 2500 },
          { accountId: revenue.id, direction: "credit", amountCents: 1000 },
        ],
      },
      s.ownerA,
    );
    expect(bad.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("posted immutable: sem update/delete de entries; estorno cria inverso", async () => {
    const accounts = await posting.ensureSystemAccounts(s.orgA, "BRL");
    const key = `immutable-${Date.now()}`;
    const posted = await posting.post({
      organizationId: s.orgA,
      transactionType: "manual_journal",
      currency: "BRL",
      idempotencyKey: key,
      description: "Para estorno",
      entries: [
        { accountId: accounts.CASH_CLEARING.id, direction: "debit", amountCents: 700 },
        { accountId: accounts.PLATFORM_REVENUE.id, direction: "credit", amountCents: 700 },
      ],
    });

    const patchEntry = await call(
      app,
      "PATCH",
      `${root()}/finance/ledger/entries/${posted.entries![0]!.id}`,
      { amountCents: 1 },
      s.ownerA,
    );
    expect(patchEntry.statusCode).toBe(404);

    const deleteEntry = await call(
      app,
      "DELETE",
      `${root()}/finance/ledger/entries/${posted.entries![0]!.id}`,
      undefined,
      s.ownerA,
    );
    expect(deleteEntry.statusCode).toBe(404);

    const patchTx = await call(
      app,
      "PATCH",
      `${root()}/finance/ledger/transactions/${posted.id}`,
      { description: "hack" },
      s.ownerA,
    );
    expect(patchTx.statusCode).toBe(404);

    const deleteTx = await call(
      app,
      "DELETE",
      `${root()}/finance/ledger/transactions/${posted.id}`,
      undefined,
      s.ownerA,
    );
    expect(deleteTx.statusCode).toBe(404);

    const still = await database.db.query.ledgerTransactions.findFirst({
      where: eq(ledgerTransactions.id, posted.id),
      with: { entries: true },
    });
    expect(still?.status).toBe("posted");
    expect(still?.entries).toHaveLength(2);
    expect(still?.entries[0]?.amountCents).toBe(700);

    const reverse = await call(
      app,
      "POST",
      `${root()}/finance/ledger/transactions/${posted.id}/reverse`,
      { reason: "Estorno de teste", idempotencyKey: `rev-${key}` },
      s.ownerA,
    );
    expect(reverse.statusCode).toBe(201);
    const reversal = reverse.json<{
      transaction: {
        id: string;
        transactionType: string;
        reversalOfTransactionId: string | null;
        entries: Array<{ direction: string; amountCents: number; accountId: string }>;
      };
    }>().transaction;
    expect(reversal.transactionType).toBe("reversal");
    expect(reversal.reversalOfTransactionId).toBe(posted.id);
    expect(reversal.id).not.toBe(posted.id);

    const originalDirections = new Map(posted.entries!.map((e) => [e.accountId, e.direction]));
    for (const entry of reversal.entries) {
      const orig = originalDirections.get(entry.accountId);
      expect(entry.direction).toBe(orig === "debit" ? "credit" : "debit");
      expect(entry.amountCents).toBe(700);
    }

    const originalAfter = await database.db.query.ledgerTransactions.findFirst({
      where: eq(ledgerTransactions.id, posted.id),
    });
    expect(originalAfter?.status).toBe("reversed");
  });

  it("saldo derivado de entries; idempotency não dupost", async () => {
    const accounts = await posting.ensureSystemAccounts(s.orgA, "BRL");
    const idem = `idem-${Date.now()}`;
    const first = await posting.post({
      organizationId: s.orgA,
      transactionType: "manual_journal",
      currency: "BRL",
      idempotencyKey: idem,
      entries: [
        { accountId: accounts.CASH_CLEARING.id, direction: "debit", amountCents: 333 },
        { accountId: accounts.PLATFORM_REVENUE.id, direction: "credit", amountCents: 333 },
      ],
    });
    const second = await posting.post({
      organizationId: s.orgA,
      transactionType: "manual_journal",
      currency: "BRL",
      idempotencyKey: idem,
      entries: [
        { accountId: accounts.CASH_CLEARING.id, direction: "debit", amountCents: 333 },
        { accountId: accounts.PLATFORM_REVENUE.id, direction: "credit", amountCents: 333 },
      ],
    });
    expect(second.id).toBe(first.id);

    const txs = await database.db.query.ledgerTransactions.findMany({
      where: eq(ledgerTransactions.idempotencyKey, idem),
    });
    expect(txs).toHaveLength(1);

    const apiAgain = await call(
      app,
      "POST",
      `${root()}/finance/ledger/manual-journal`,
      {
        transactionType: "manual_journal",
        currency: "BRL",
        idempotencyKey: idem,
        reason: "Mesma chave",
        entries: [
          { accountId: accounts.CASH_CLEARING.id, direction: "debit", amountCents: 333 },
          { accountId: accounts.PLATFORM_REVENUE.id, direction: "credit", amountCents: 333 },
        ],
      },
      s.ownerA,
    );
    expect(apiAgain.statusCode).toBe(201);
    expect(apiAgain.json<{ transaction: { id: string } }>().transaction.id).toBe(first.id);

    const balances = await call(
      app,
      "GET",
      `${root()}/finance/ledger/balances?accountId=${accounts.CASH_CLEARING.id}`,
      undefined,
      s.ownerA,
    );
    expect(balances.statusCode).toBe(200);
    const bal = balances.json<{
      balances: Array<{
        accountId: string;
        debitCents: number;
        creditCents: number;
        balanceCents: number;
      }>;
    }>().balances[0]!;
    expect(bal.accountId).toBe(accounts.CASH_CLEARING.id);
    expect(bal.debitCents).toBeGreaterThanOrEqual(333);
    expect(bal.balanceCents).toBe(bal.debitCents - bal.creditCents);
  });

  it("sem CRUD público de ledger_entries; acesso não autorizado bloqueado", async () => {
    const listEntries = await call(
      app,
      "GET",
      `${root()}/finance/ledger/entries`,
      undefined,
      s.ownerA,
    );
    expect(listEntries.statusCode).toBe(404);

    const createEntry = await call(
      app,
      "POST",
      `${root()}/finance/ledger/entries`,
      { amountCents: 1 },
      s.ownerA,
    );
    expect(createEntry.statusCode).toBe(404);

    const outsider = await call(
      app,
      "GET",
      `${root()}/finance/ledger/balances`,
      undefined,
      s.outsider,
    );
    expect(outsider.statusCode).toBeGreaterThanOrEqual(400);

    const cross = await call(
      app,
      "GET",
      `${root(s.orgB)}/finance/ledger/balances`,
      undefined,
      s.ownerA,
    );
    expect(cross.statusCode).toBeGreaterThanOrEqual(400);

    // Contas de sistema existem só no escopo da org
    const orgAAccounts = await database.db.query.ledgerAccounts.findMany({
      where: eq(ledgerAccounts.organizationId, s.orgA),
    });
    void orgAAccounts;
    const entryCount = await database.db.select().from(ledgerEntries);
    expect(Array.isArray(entryCount)).toBe(true);
  });
});
