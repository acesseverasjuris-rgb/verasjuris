# ADR 102 — Request previdenciário especializado sobre AdministrativeProcess

## Status

Aceito (Prompt 16).

## Decisão

- `previdentiary_requests` exige `administrativeProcessId` (FK) e especializa o fluxo (tipo, DER, protocolo, perícia, avaliação social).
- Não substitui `administrative_requests` genéricos; acrescenta camada previdenciária sobre o processo administrativo do matter.
- Protocolo permanece manual / `protocolVerificationStatus` honesto (`manual`, `not_configured`, etc.) — sem confirmação do órgão.

## Motivo

Requerimento de benefício precisa de campos e status próprios sem duplicar o agregado administrativo nem fingir integração INSS.

## Relacionado

`docs/PREVIDENTIARY_ADMIN_REQUESTS.md`, `docs/ADMINISTRATIVE_PROCESSES.md`, ADR 047
