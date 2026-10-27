"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@verasjuris/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { AUCTION_TABS } from "../../../../components/auction-ui";
import {
  AUCTION_STATUS_LABELS,
  AUCTION_TYPE_LABELS,
  auctionErrorMessage,
  createAuction,
  hasAuctionPermission,
  isApiFailure,
  type AuctionStatus,
  type AuctionType,
  type CreateAuctionInput,
} from "../../../../lib/auctions";
import { useOrgContext } from "../../../../lib/use-org-context";

function dateToIso(value: string, endOfDay = false): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T${endOfDay ? "23:59:00" : "00:00:00"}`).toISOString();
}

export default function NovoLeilaoPage() {
  const router = useRouter();
  const org = useOrgContext();
  const canCreate = hasAuctionPermission(org.permissions, "create");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [auctionType, setAuctionType] = useState<AuctionType>("judicial");
  const [status, setStatus] = useState<AuctionStatus>("draft");
  const [sellerName, setSellerName] = useState("");
  const [sellerType, setSellerType] = useState("");
  const [firstEventAt, setFirstEventAt] = useState("");
  const [secondEventAt, setSecondEventAt] = useState("");
  const [closingAt, setClosingAt] = useState("");
  const [publicationDate, setPublicationDate] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Leilões", href: "/app/leiloes" },
    { label: "Cadastro manual" },
  ];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId) {
      setError("Nenhuma organização ativa.");
      return;
    }
    const next: Record<string, string> = {};
    if (!title.trim() || title.trim().length < 2) next.title = "Informe o título.";
    if (sourceUrl.trim() && !sourceUrl.trim().startsWith("https://")) {
      next.sourceUrl = "O link deve começar com https://.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    setError(null);
    const payload: CreateAuctionInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      auctionType,
      status,
      sellerName: sellerName.trim() || undefined,
      sellerType: sellerType.trim() || undefined,
      firstEventAt: dateToIso(firstEventAt),
      secondEventAt: dateToIso(secondEventAt),
      closingAt: dateToIso(closingAt, true),
      publicationDate: dateToIso(publicationDate),
      sourceUrl: sourceUrl.trim() || undefined,
      sourceReference: sourceReference.trim() || undefined,
    };
    const data = await createAuction(org.orgId, payload);
    if (isApiFailure(data)) {
      setError(auctionErrorMessage(data, "Não foi possível cadastrar o leilão."));
      setPending(false);
      return;
    }
    router.push(`/app/leiloes/${data.auction.id}`);
  }

  if (org.ready && !canCreate) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para cadastrar leilões.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Cadastro manual de leilão"
        description="Registre um leilão a partir de informações conferidas na fonte. Cadastro manual não é apresentado como fonte oficial."
      />
      <SectionTabs label="Seções de leilões" items={AUCTION_TABS} current="/app/leiloes/novo" />

      <Alert tone="info" title="FONTE · Cadastro manual">
        Informe o link https do edital ou página original sempre que disponível. Confira datas e
        valores na fonte antes de decidir.
      </Alert>

      {error ? <ErrorState title="Cadastro">{error}</ErrorState> : null}

      <form className="vj-card vj-stack" onSubmit={(event) => void onSubmit(event)}>
        <FormField id="lei-title" label="Título" error={errors.title}>
          <Input
            id="lei-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            autoComplete="off"
          />
        </FormField>
        <FormField id="lei-desc" label="Descrição">
          <Textarea
            id="lei-desc"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
          />
        </FormField>
        <div className="vj-split">
          <FormField id="lei-type" label="Tipo">
            <Select
              id="lei-type"
              value={auctionType}
              onChange={(event) => setAuctionType(event.target.value as AuctionType)}
            >
              {Object.entries(AUCTION_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="lei-status" label="Situação">
            <Select
              id="lei-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as AuctionStatus)}
            >
              {Object.entries(AUCTION_STATUS_LABELS)
                .filter(([key]) => key !== "not_configured" && key !== "archived")
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </Select>
          </FormField>
        </div>
        <div className="vj-split">
          <FormField id="lei-seller" label="Vendedor / alienante">
            <Input
              id="lei-seller"
              value={sellerName}
              onChange={(event) => setSellerName(event.target.value)}
              autoComplete="off"
            />
          </FormField>
          <FormField id="lei-seller-type" label="Tipo de vendedor">
            <Input
              id="lei-seller-type"
              value={sellerType}
              onChange={(event) => setSellerType(event.target.value)}
              autoComplete="off"
              placeholder="Ex.: banco, particular, órgão"
            />
          </FormField>
        </div>
        <div className="vj-split">
          <FormField id="lei-pub" label="Data de publicação">
            <Input
              id="lei-pub"
              type="date"
              value={publicationDate}
              onChange={(event) => setPublicationDate(event.target.value)}
            />
          </FormField>
          <FormField id="lei-first" label="Primeiro evento">
            <Input
              id="lei-first"
              type="datetime-local"
              value={firstEventAt}
              onChange={(event) => setFirstEventAt(event.target.value)}
            />
          </FormField>
        </div>
        <div className="vj-split">
          <FormField id="lei-second" label="Segundo evento">
            <Input
              id="lei-second"
              type="datetime-local"
              value={secondEventAt}
              onChange={(event) => setSecondEventAt(event.target.value)}
            />
          </FormField>
          <FormField id="lei-close" label="Encerramento">
            <Input
              id="lei-close"
              type="datetime-local"
              value={closingAt}
              onChange={(event) => setClosingAt(event.target.value)}
            />
          </FormField>
        </div>
        <FormField id="lei-url" label="URL da fonte (https)" error={errors.sourceUrl}>
          <Input
            id="lei-url"
            type="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://"
            autoComplete="off"
          />
        </FormField>
        <FormField id="lei-ref" label="Referência na fonte">
          <Input
            id="lei-ref"
            value={sourceReference}
            onChange={(event) => setSourceReference(event.target.value)}
            autoComplete="off"
            placeholder="Número do edital ou código"
          />
        </FormField>
        <div className="vj-inline-actions">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Cadastrar leilão"}
          </Button>
          <a className="vj-button vj-button-secondary" href="/app/leiloes">
            Cancelar
          </a>
        </div>
      </form>
    </div>
  );
}
