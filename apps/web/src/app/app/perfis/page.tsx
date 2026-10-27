"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
} from "@verasjuris/ui";
import { CSRF_HEADER } from "@verasjuris/security/constants";
import { useEffect, useState } from "react";
import type { ApiFailure } from "../../../lib/types";
import { getActiveOrgId, fetchSessionAccount } from "../../../lib/crm";

type LawyerProfile = {
  professionalName?: string;
  bio?: string;
  oabNumber?: string;
  oabUf?: string;
  practiceAreas?: string;
  languages?: string;
  remoteAvailable?: boolean;
  inPersonAvailable?: boolean;
  serviceRegions?: string;
  visibility?: string;
};

type PartnerProfile = {
  category?: string;
  presentation?: string;
  services?: string;
  regions?: string;
  remoteAvailable?: boolean;
  inPersonAvailable?: boolean;
  availabilityNotes?: string;
  publicInfo?: string;
  visibility?: string;
};

type EmployeeProfile = {
  jobTitle?: string;
  department?: string;
  internalCode?: string;
  status?: string;
  internalNotes?: string;
};

type VerificationStatus = "not_submitted" | "pending" | "verified" | "rejected";

type ProfilesResponse = {
  profiles: {
    professional: {
      verificationStatus: VerificationStatus;
    } | null;
    lawyer: LawyerProfile | null;
    partner: PartnerProfile | null;
    employees: EmployeeProfile[];
  };
};

const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  not_submitted: "Verificação profissional ainda não configurada nesta versão.",
  pending: "Verificação em análise. Nenhuma confirmação externa foi concluída.",
  verified: "Verificação registrada pela plataforma.",
  rejected: "Verificação recusada. Revise os dados ou aguarde orientação.",
};

const PARTNER_CATEGORIES: Record<string, string> = {
  correspondent: "Correspondente",
  accountant: "Contador",
  expert: "Perito",
  translator: "Tradutor",
  dispatcher: "Despachante",
  teacher: "Professor",
  specialist: "Especialista",
  supplier: "Fornecedor",
  other: "Outro",
};

function jsonHeaders(): HeadersInit {
  return { "content-type": "application/json", [CSRF_HEADER]: "1" };
}

export default function ProfilesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("not_submitted");
  const [enabled, setEnabled] = useState({ lawyer: false, partner: false, employee: false });
  const [lawyer, setLawyer] = useState<LawyerProfile>({});
  const [partner, setPartner] = useState<PartnerProfile>({ category: "other" });
  const [employee, setEmployee] = useState<EmployeeProfile>({ jobTitle: "" });
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [activeId, account] = await Promise.all([getActiveOrgId(), fetchSessionAccount()]);
      setOrgId(activeId);
      if (account?.professionalVerificationStatus) {
        setVerificationStatus(account.professionalVerificationStatus);
      }
      const query = activeId ? `?organizationId=${activeId}` : "";
      const response = await fetch(`/api/v1/profiles/me${query}`, { cache: "no-store" });
      if (!response.ok) {
        setLoading(false);
        setError("Não foi possível carregar os perfis profissionais.");
        return;
      }
      const body = (await response.json()) as ProfilesResponse;
      const profiles = body.profiles;
      const status =
        profiles.professional?.verificationStatus ?? account?.professionalVerificationStatus;
      if (status) setVerificationStatus(status);
      const employeeForOrg = profiles.employees[0] ?? null;
      setEnabled({
        lawyer: Boolean(profiles.lawyer),
        partner: Boolean(profiles.partner),
        employee: Boolean(employeeForOrg),
      });
      if (profiles.lawyer) setLawyer(profiles.lawyer);
      if (profiles.partner) setPartner(profiles.partner);
      if (employeeForOrg) setEmployee(employeeForOrg);
      setLoading(false);
    })();
  }, []);

  function toggleProfile(key: keyof typeof enabled) {
    setEnabled((current) => ({ ...current, [key]: !current[key] }));
  }

  async function saveProfile(kind: "lawyer" | "partner" | "employee") {
    setPending(true);
    setError(null);
    setMessage(null);
    const url =
      kind === "lawyer"
        ? "/api/v1/profiles/me/lawyer"
        : kind === "partner"
          ? "/api/v1/profiles/me/partner"
          : orgId
            ? `/api/v1/organizations/${orgId}/profiles/employees/me`
            : null;
    if (!url) {
      setPending(false);
      setError("Selecione uma organização ativa para salvar o perfil de funcionário.");
      return;
    }
    const payload = kind === "lawyer" ? lawyer : kind === "partner" ? partner : employee;
    const response = await fetch(url, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => ({}))) as ApiFailure;
    setPending(false);
    if (!response.ok) {
      setError(data.error?.message ?? "Não foi possível salvar o perfil.");
      return;
    }
    setMessage(
      kind === "lawyer"
        ? "Perfil de advogado salvo."
        : kind === "partner"
          ? "Perfil de parceiro salvo."
          : "Perfil de funcionário salvo para a organização ativa.",
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Conta", href: "/app/conta" },
          { label: "Perfis e vínculos" },
        ]}
      />
      <PageHeader
        title="Perfis e vínculos"
        description="Configure um ou mais perfis profissionais. Eles se acumulam — você pode ser advogado, parceiro e funcionário ao mesmo tempo."
      />
      {loading ? <LoadingState label="Carregando perfis" /> : null}
      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      {!loading ? (
        <>
          <Alert
            tone={
              verificationStatus === "verified"
                ? "success"
                : verificationStatus === "rejected"
                  ? "warning"
                  : "info"
            }
            title={VERIFICATION_LABELS[verificationStatus]}
          >
            {verificationStatus === "not_submitted"
              ? "Informações de OAB e validação externa não são exibidas como concluídas nesta versão."
              : "O status exibido reflete apenas o que foi registrado nesta conta."}
          </Alert>
          <section className="vj-card vj-stack" aria-labelledby="profile-types">
            <h2 id="profile-types" className="vj-section-title">
              Tipos de perfil
            </h2>
            <p className="vj-prose">
              Marque todos os perfis que se aplicam à sua atuação. Cada um possui campos próprios.
            </p>
            <div className="vj-stack">
              <label>
                <input
                  type="checkbox"
                  checked={enabled.lawyer}
                  onChange={() => toggleProfile("lawyer")}
                />{" "}
                Advogado(a)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={enabled.partner}
                  onChange={() => toggleProfile("partner")}
                />{" "}
                Parceiro(a)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={enabled.employee}
                  onChange={() => toggleProfile("employee")}
                />{" "}
                Funcionário(a) da organização
              </label>
            </div>
          </section>
          {enabled.lawyer ? (
            <section className="vj-card vj-stack" aria-labelledby="lawyer-profile">
              <h2 id="lawyer-profile" className="vj-section-title">
                Perfil de advogado
              </h2>
              <Alert
                tone="info"
                title="Verificação profissional ainda não configurada nesta versão."
              >
                Os campos de OAB são informativos. Nenhuma inscrição é validada automaticamente.
              </Alert>
              <div className="vj-split">
                <FormField id="professionalName" label="Nome profissional">
                  <Input
                    id="professionalName"
                    value={lawyer.professionalName ?? ""}
                    onChange={(event) =>
                      setLawyer((current) => ({ ...current, professionalName: event.target.value }))
                    }
                  />
                </FormField>
                <FormField id="oabNumber" label="Número OAB">
                  <Input
                    id="oabNumber"
                    value={lawyer.oabNumber ?? ""}
                    onChange={(event) =>
                      setLawyer((current) => ({ ...current, oabNumber: event.target.value }))
                    }
                  />
                </FormField>
              </div>
              <div className="vj-split">
                <FormField id="oabUf" label="UF OAB">
                  <Input
                    id="oabUf"
                    value={lawyer.oabUf ?? ""}
                    maxLength={2}
                    onChange={(event) =>
                      setLawyer((current) => ({ ...current, oabUf: event.target.value }))
                    }
                  />
                </FormField>
                <FormField id="practiceAreas" label="Áreas de atuação">
                  <Input
                    id="practiceAreas"
                    value={lawyer.practiceAreas ?? ""}
                    onChange={(event) =>
                      setLawyer((current) => ({ ...current, practiceAreas: event.target.value }))
                    }
                  />
                </FormField>
              </div>
              <FormField id="bio" label="Apresentação">
                <Textarea
                  id="bio"
                  value={lawyer.bio ?? ""}
                  onChange={(event) =>
                    setLawyer((current) => ({ ...current, bio: event.target.value }))
                  }
                />
              </FormField>
              <div className="vj-inline-actions">
                <label>
                  <input
                    type="checkbox"
                    checked={lawyer.remoteAvailable ?? false}
                    onChange={(event) =>
                      setLawyer((current) => ({
                        ...current,
                        remoteAvailable: event.target.checked,
                      }))
                    }
                  />{" "}
                  Atendimento remoto
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={lawyer.inPersonAvailable ?? false}
                    onChange={(event) =>
                      setLawyer((current) => ({
                        ...current,
                        inPersonAvailable: event.target.checked,
                      }))
                    }
                  />{" "}
                  Atendimento presencial
                </label>
              </div>
              <Button type="button" loading={pending} onClick={() => void saveProfile("lawyer")}>
                Salvar perfil de advogado
              </Button>
            </section>
          ) : null}
          {enabled.partner ? (
            <section className="vj-card vj-stack" aria-labelledby="partner-profile">
              <h2 id="partner-profile" className="vj-section-title">
                Perfil de parceiro
              </h2>
              <FormField id="category" label="Categoria">
                <Select
                  id="category"
                  value={partner.category ?? "other"}
                  onChange={(event) =>
                    setPartner((current) => ({ ...current, category: event.target.value }))
                  }
                >
                  {Object.entries(PARTNER_CATEGORIES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField id="presentation" label="Apresentação">
                <Textarea
                  id="presentation"
                  value={partner.presentation ?? ""}
                  onChange={(event) =>
                    setPartner((current) => ({ ...current, presentation: event.target.value }))
                  }
                />
              </FormField>
              <FormField id="services" label="Serviços">
                <Input
                  id="services"
                  value={partner.services ?? ""}
                  onChange={(event) =>
                    setPartner((current) => ({ ...current, services: event.target.value }))
                  }
                />
              </FormField>
              <FormField id="regions" label="Regiões">
                <Input
                  id="regions"
                  value={partner.regions ?? ""}
                  onChange={(event) =>
                    setPartner((current) => ({ ...current, regions: event.target.value }))
                  }
                />
              </FormField>
              <Button type="button" loading={pending} onClick={() => void saveProfile("partner")}>
                Salvar perfil de parceiro
              </Button>
            </section>
          ) : null}
          {enabled.employee ? (
            <section className="vj-card vj-stack" aria-labelledby="employee-profile">
              <h2 id="employee-profile" className="vj-section-title">
                Perfil de funcionário
              </h2>
              {!orgId ? (
                <p className="vj-meta">
                  Selecione uma organização ativa para vincular o perfil de funcionário.
                </p>
              ) : null}
              <FormField id="jobTitle" label="Cargo">
                <Input
                  id="jobTitle"
                  required
                  value={employee.jobTitle ?? ""}
                  onChange={(event) =>
                    setEmployee((current) => ({ ...current, jobTitle: event.target.value }))
                  }
                />
              </FormField>
              <FormField id="department" label="Departamento">
                <Input
                  id="department"
                  value={employee.department ?? ""}
                  onChange={(event) =>
                    setEmployee((current) => ({ ...current, department: event.target.value }))
                  }
                />
              </FormField>
              <FormField id="internalCode" label="Código interno">
                <Input
                  id="internalCode"
                  value={employee.internalCode ?? ""}
                  onChange={(event) =>
                    setEmployee((current) => ({ ...current, internalCode: event.target.value }))
                  }
                />
              </FormField>
              <Button
                type="button"
                loading={pending}
                disabled={!orgId}
                onClick={() => void saveProfile("employee")}
              >
                Salvar perfil de funcionário
              </Button>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
