# Contratos (Etapas 11–13)

## Princípio

**Contract ≠ Document ≠ LegalDraft ≠ LegalDocumentTemplate.**

Contrato operacional/comercial (`contracts`) gerencia ciclo de vida, partes, cláusulas, aprovação, assinatura, renovação e rescisão — sem substituir binário em `documents` nem minuta em `legal_document_drafts` (ADRs 119–120).

Schema: `packages/database/src/schema/contracts.ts`. Rotas: `apps/api/src/modules/contracts/`. ADRs 119–126.

## Modelo

| Entidade | Papel |
| --- | --- |
| `contract_templates` | Modelo de contrato (reutiliza motor de variáveis — ADR 121) |
| `contracts` | Agregado (`status`, renovação, matter/cliente opcionais) |
| `contract_versions` | Versões imutáveis após assinatura (ADR 122) |
| `contract_parties` | Partes com `contract_party_role` |
| `contract_clauses` / `contract_clause_instances` | Biblioteca + snapshot na versão (ADR 123) |
| `contract_approval_policies` / `contract_approvals` | Fluxo de aprovação |
| `signature_requests` / `signature_signers` | Assinatura via provider ou manual |
| `manual_signature_records` | Registro manual / wet ink (ADR 125) |
| `contract_renewals` / `contract_terminations` | Renovação e rescisão (ADR 126) |
| `contract_obligations` / `contract_amendments` | Obrigações pós-assinatura e aditivos |
| `contract_timeline_events` | Timeline operacional |

## Status (contrato)

`draft` → revisão/aprovação → `pending_signature` → `signed` / `active` → `expiring` | `expired` | `terminated` | `cancelled` | `archived`.

## Relação com LegalMatter

FK opcional `legalMatterId`; contrato pode existir só com cliente CRM. Documento assinado referencia `document_versions` quando exportado — não é o contrato lógico.

## RBAC

`contract.read` | `create` | `update` | `manage_parties` | `manage_clauses` | `review` | `approve` | `request_signature` | `record_signature` | `manage_renewal` | `terminate` | `manage_obligations` | `archive`.

## API (resumo)

Prefixo: `/v1/organizations/:organizationId` — `contracts`, `contract-templates`, `contract-clauses`, `contract-approval-policies`, sub-recursos por contrato.

## NOT_CONFIGURED

Assinatura eletrônica real (`SignatureProvider`); sync status (`SIGNATURE_STATUS_SYNC`); alertas de vencimento via fila externa (`CONTRACT_ALERT`, `CONTRACT_RENEWAL_ALERT`); revisão IA assíncrona (`CONTRACT_AI_REVIEW`).

## Portal e consultas online (Etapas 14–16)

- Portal lista contratos do cliente vinculado (`policyClientContract` / leitura projetada).
- Consulta online pode referenciar `contracts.id` opcionalmente após match (`online_consultations.contractId`).

## Relacionado

`docs/CONTRACT_SIGNATURES.md`, `docs/SIGNATURE_PROVIDERS.md`, `docs/LEGAL_DOCUMENT_TEMPLATES.md`, `docs/CLIENT_PORTAL.md`, `docs/ONLINE_CONSULTATIONS.md`, ADRs 119–126
