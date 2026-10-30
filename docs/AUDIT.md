# Auditoria

Trilha persistente das mutações já existentes (pacote `@verasjuris/audit`, permissão `audit.read`, UI `/app/auditoria`).

## VerasJuris Control / Analytics / Workflows

Domínios internos (Etapa 23+): operação da organização (`docs/CONTROL.md` e satélites), analytics como read model (`docs/ANALYTICS.md`) e automações (`docs/WORKFLOWS.md`). ADRs 192–211. UI sob `/app/control/*`. Mutações Control/Workflow devem emitir eventos de auditoria quando a API pousar. Não confundir com produto cliente nem com financeiro de plataforma (`docs/FINANCE.md`).


## Auditoria platform hardening

Eventos de MFA/passkey/session revoke, DSR, security alerts, mudanças enterprise e assistant actions relevantes devem ir ao audit log existente (sem segundo sistema de auditoria).
