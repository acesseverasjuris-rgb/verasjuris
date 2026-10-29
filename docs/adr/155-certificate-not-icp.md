# ADR 155 — Certificado educacional ≠ certificado ICP

## Status

Accepted

## Context

Risco de UI/docs sugerirem validade de assinatura digital qualificada ou ICP-Brasil.

## Decision

- `education_certificates` = atestado de conclusão da plataforma (número + código de verificação).
- PDF default `PDF_GENERATION_NOT_CONFIGURED`.
- Não confundir com `SignatureProvider` / ICP / OAB.

## Consequences

Verificação pública sem claim de autenticidade ICP; copy honesta na UI.
