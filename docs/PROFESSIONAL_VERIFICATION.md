# Verificação profissional (Etapa 17.1)

Perfil de advogado ≠ verificação. Casos por tipo (`oab`, `cpf`, `biometric`, …) com status explícito.

- OAB informada não vira `verified` sem provedor.
- CPF: `isValidCpfChecksum` separado de bureau (`CPFVerificationProvider`).
- Biometria: consentimento + sessão externa; sem template bruto; NOT_CONFIGURED não simula pass.
- Revisão manual com bloqueio de autoaprovação.
- Suspensões e revalidações auditadas.
- `trust-summary` expõe apenas indicadores públicos permitidos.

API: `/v1/professional-verification/*` e `/v1/organizations/:orgId/professional-verification/*`.
