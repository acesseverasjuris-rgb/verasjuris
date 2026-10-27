import type { MemoryEmailProvider } from "@verasjuris/email";
import { CSRF_HEADER, SESSION_COOKIE } from "@verasjuris/security";
import type { FastifyInstance } from "fastify";
import { expect } from "vitest";
import { call, registerVerified } from "./test-helpers.js";

export type Etapa6Setup = {
  ownerA: string;
  memberA: string;
  ownerB: string;
  outsider: string;
  orgA: string;
  orgB: string;
  matterAId: string;
};

/** Duas organizações isoladas (A e B), um membro comum em A e um usuário sem vínculo. */
export async function bootstrapEtapa6(
  app: FastifyInstance,
  email: MemoryEmailProvider,
  prefix: string,
): Promise<Etapa6Setup> {
  const ownerA = await registerVerified(app, email, {
    displayName: `Owner A ${prefix}`,
    email: `owner.a.${prefix}@exemplo.com`,
  });
  const memberA = await registerVerified(app, email, {
    displayName: `Member A ${prefix}`,
    email: `member.a.${prefix}@exemplo.com`,
  });
  const ownerB = await registerVerified(app, email, {
    displayName: `Owner B ${prefix}`,
    email: `owner.b.${prefix}@exemplo.com`,
  });
  const outsider = await registerVerified(app, email, {
    displayName: `Outsider ${prefix}`,
    email: `outsider.${prefix}@exemplo.com`,
  });

  const createdA = await call(
    app,
    "POST",
    "/v1/organizations",
    { name: `Org ${prefix} A` },
    ownerA,
  );
  const orgA = createdA.json<{ organization: { id: string } }>().organization.id;
  const createdB = await call(
    app,
    "POST",
    "/v1/organizations",
    { name: `Org ${prefix} B` },
    ownerB,
  );
  const orgB = createdB.json<{ organization: { id: string } }>().organization.id;

  const added = await call(
    app,
    "POST",
    `/v1/organizations/${orgA}/members`,
    { email: `member.a.${prefix}@exemplo.com` },
    ownerA,
  );
  expect(added.statusCode).toBeLessThan(300);

  const client = await call(
    app,
    "POST",
    `/v1/organizations/${orgA}/crm/clients`,
    { personType: "person", fullName: `Cliente ${prefix}` },
    ownerA,
  );
  const clientId = client.json<{ client: { id: string } }>().client.id;
  const matter = await call(
    app,
    "POST",
    `/v1/organizations/${orgA}/matters`,
    { title: `Caso ${prefix}`, clientId },
    ownerA,
  );
  const matterAId = matter.json<{ matter: { id: string } }>().matter.id;
  return { ownerA, memberA, ownerB, outsider, orgA, orgB, matterAId };
}

export function multipartBody(fileName: string, content: Buffer, mime: string) {
  const boundary = "----VjBoundary7MA4YWxkTrZu0gW";
  const preamble =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
    `Content-Type: ${mime}\r\n\r\n`;
  const ending = `\r\n--${boundary}--\r\n`;
  return {
    payload: Buffer.concat([Buffer.from(preamble, "utf8"), content, Buffer.from(ending, "utf8")]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export async function createDocumentWithFile(
  app: FastifyInstance,
  cookie: string,
  organizationId: string,
  ownerId: string,
  input: {
    title: string;
    fileName: string;
    content: Buffer;
    mime: string;
    ownerType?: "legal_matter" | "organization";
    confidentialityLevel?: "normal" | "restricted" | "confidential";
  },
): Promise<{ documentId: string; versionId: string }> {
  const created = await call(
    app,
    "POST",
    `/v1/organizations/${organizationId}/documents`,
    {
      title: input.title,
      ownerType: input.ownerType ?? "legal_matter",
      ownerId,
      confidentialityLevel: input.confidentialityLevel ?? "normal",
    },
    cookie,
  );
  expect(created.statusCode).toBe(201);
  const documentId = created.json<{ document: { id: string } }>().document.id;
  const multipart = multipartBody(input.fileName, input.content, input.mime);
  const uploaded = await app.inject({
    method: "POST",
    url: `/v1/organizations/${organizationId}/documents/${documentId}/versions`,
    headers: {
      [CSRF_HEADER]: "1",
      cookie: `${SESSION_COOKIE}=${cookie}`,
      "content-type": multipart.contentType,
    },
    payload: multipart.payload,
  });
  expect(uploaded.statusCode).toBe(201);
  const versionId = uploaded.json<{ version: { id: string } }>().version.id;
  return { documentId, versionId };
}

/** PDF mínimo COM camada de texto nativa (stream sem filtro). */
export function textPdf(text: string): Buffer {
  const content = `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;
  return Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n2 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\ntrailer\n<<>>\n%%EOF\n`,
    "utf8",
  );
}

/** PDF sem camada de texto (como um escaneado): exige OCR. */
export function scannedPdf(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\ntrailer\n<<>>\n%%EOF\n",
    "utf8",
  );
}

/** Saída válida do esquema de análise jurídica (fixture de TESTE — nunca usada fora dos testes). */
export function validLegalAnalysisOutput(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "1",
    summary: "Resumo assistivo do caso para revisão.",
    facts: [
      {
        text: "O contrato foi assinado em 10 de janeiro de 2024.",
        category: "contrato",
        disputeStatus: "undisputed",
        confidence: 90,
        sourceLabel: "Contrato",
        pageNumber: 1,
      },
      {
        text: "A parte ré deixou de pagar a parcela de março.",
        disputeStatus: "disputed",
        confidence: 70,
      },
    ],
    claims: [
      { text: "Pagamento do valor de R$ 10.000,00.", claimType: "cobranca", relatedParty: "Autor" },
    ],
    groundsPresent: [
      {
        kind: "present_in_document",
        text: "Art. 389 do Código Civil.",
        sourceLabel: "Petição inicial",
        pageNumber: 1,
        confidence: 80,
      },
    ],
    groundsSuggested: [
      {
        kind: "suggested_by_ai",
        text: "Possível aplicação do art. 475 do Código Civil.",
        confidence: 40,
        requiresHumanVerification: true,
      },
    ],
    evidence: [{ proposition: "Assinatura do contrato.", factIndex: 0, pageNumber: 1 }],
    contradictions: [
      {
        statementA: "O pagamento foi feito em março.",
        statementB: "Não houve pagamento em março.",
        severity: "medium",
        confidence: 50,
      },
    ],
    dates: [{ dateValue: "2024-01-10", dateType: "assinatura", confidence: 90 }],
    parties: [{ name: "João da Silva", inferredRole: "autor", confidence: 80 }],
    amounts: [
      { originalText: "R$ 10.000,00", amountCents: 1_000_000, currency: "BRL", confidence: 90 },
    ],
    obligations: [
      { obligor: "Réu", action: "Pagar o valor principal", amountCents: 1_000_000, confidence: 70 },
    ],
    missingInformation: [{ category: "documentos", description: "Falta a procuração." }],
    ...overrides,
  };
}
