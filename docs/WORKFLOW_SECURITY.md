# Workflow Security

- Sem execução arbitrária de código (ADR 208).
- DSL de condição limitada a operadores allowlisted (ADR 206).
- Ações exigem permissão quando `requiredPermission` está setado.
- Logs sem segredos em claro; tenant isolation no path da org.
- Dry-run obrigatoriamente seguro (ADR 211).
