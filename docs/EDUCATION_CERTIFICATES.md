# Certificados educacionais

## Princípio

`education_certificates` atesta conclusão de curso no VerasJuris. **Não** é certificado digital ICP-Brasil, assinatura eletrônica qualificada nem credencial OAB (ADR 155).

## Emissão

Após conclusão elegível (`issueCertificate`): `certificateNumber` + `verificationCode` únicos; status `issued` | `revoked` | `expired`. Um certificado por matrícula.

## PDF

`pdfGenerationStatus` default `PDF_GENERATION_NOT_CONFIGURED`. `documentId` só quando houver artefato real em Documents. UI de verificação pública (`/educacao/certificados/verificar`) consulta código — sem prometer autenticidade ICP.

## Revogação

`education.certificate.revoke` marca `revokedAt` / status `revoked`.

## Relacionado

`docs/EDUCATION.md`, `docs/CONTRACT_SIGNATURES.md` (assinatura ≠ este certificado), ADR 155.
