import { Alert, Badge } from "@verasjuris/ui";
import type { VerificationCase } from "../lib/professional-verification";

export function VerificationDisclaimer() {
  return (
    <Alert tone="warning" title="Verificação profissional">
      OAB informada ≠ verificada. CPF válido ≠ identidade. Provedores externos podem estar
      NOT_CONFIGURED.
    </Alert>
  );
}

export function VerificationCaseRow({ item }: { item: VerificationCase }) {
  return (
    <tr>
      <td>{item.verificationType}</td>
      <td>
        <Badge tone="neutral">{item.status}</Badge>
      </td>
    </tr>
  );
}
