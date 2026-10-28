import { PageHeader } from "@verasjuris/ui";

export default function PortalServicosExtrajudiciaisPage() {
  return (
    <main className="vj-page">
      <PageHeader
        title="Serviços extrajudiciais"
        description="Disponível quando sua organização habilitar o portal para este serviço."
      />
      <p className="vj-muted">
        Cartórios manuais aparecem como não verificados. Emolumentos oficiais exigem integração
        configurada.
      </p>
    </main>
  );
}
