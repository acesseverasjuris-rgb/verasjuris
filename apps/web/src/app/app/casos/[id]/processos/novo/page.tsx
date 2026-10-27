"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  ButtonLink,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  apiErrorMessage,
  CONFIDENTIALITY_LABELS,
  createJudicialProcess,
  fetchCourts,
  fetchCourtUnits,
  fetchJudicialDistricts,
  fetchProceduralClasses,
  fetchProceduralSubjects,
  getActiveMembership,
  getActiveOrgId,
  hasJudicialPermission,
  isApiFailure,
  validateCnjNumber,
  type Court,
  type CourtUnit,
  type JudicialConfidentiality,
  type JudicialDistrict,
  type ProceduralClass,
  type ProceduralSubject,
} from "../../../../../../lib/judicial";
import { fetchMatter } from "../../../../../../lib/matters";

export default function NovoProcessoJudicialPage() {
  const params = useParams<{ id: string }>();
  const matterId = params.id;

  const [orgId, setOrgId] = useState<string | null>(null);
  const [canCreate, setCanCreate] = useState(true);
  const [loading, setLoading] = useState(true);
  const [matterTitle, setMatterTitle] = useState("Caso");
  const [matterRef, setMatterRef] = useState("");
  const [courts, setCourts] = useState<Court[]>([]);
  const [courtUnits, setCourtUnits] = useState<CourtUnit[]>([]);
  const [districts, setDistricts] = useState<JudicialDistrict[]>([]);
  const [classes, setClasses] = useState<ProceduralClass[]>([]);
  const [subjects, setSubjects] = useState<ProceduralSubject[]>([]);

  const [cnjNumber, setCnjNumber] = useState("");
  const [tribunalId, setTribunalId] = useState("");
  const [courtUnitId, setCourtUnitId] = useState("");
  const [courtUnitText, setCourtUnitText] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [districtText, setDistrictText] = useState("");
  const [proceduralClassId, setProceduralClassId] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [confidentialityLevel, setConfidentialityLevel] =
    useState<JudicialConfidentiality>("public");

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const cnjValidation = useMemo(
    () => (cnjNumber.trim() ? validateCnjNumber(cnjNumber) : null),
    [cnjNumber],
  );

  useEffect(() => {
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      setCanCreate(hasJudicialPermission(membership?.permissions, "create"));
      setOrgId(activeId);

      const [matterData, courtsData, classesData, subjectsData] = await Promise.all([
        fetchMatter(activeId, matterId),
        fetchCourts(activeId),
        fetchProceduralClasses(activeId),
        fetchProceduralSubjects(activeId),
      ]);
      if (!isApiFailure(matterData)) {
        setMatterTitle(matterData.matter.title);
        setMatterRef(matterData.matter.internalReference);
      }
      if (!isApiFailure(courtsData))
        setCourts(courtsData.courts.filter((item) => item.active !== false));
      if (!isApiFailure(classesData)) {
        setClasses(classesData.proceduralClasses.filter((item) => item.active !== false));
      }
      if (!isApiFailure(subjectsData)) {
        setSubjects(subjectsData.proceduralSubjects.filter((item) => item.active !== false));
      }
      setLoading(false);
    })();
  }, [matterId]);

  useEffect(() => {
    if (!orgId || !tribunalId) {
      setCourtUnits([]);
      setDistricts([]);
      setCourtUnitId("");
      setDistrictId("");
      return;
    }
    void (async () => {
      const [unitsData, districtsData] = await Promise.all([
        fetchCourtUnits(orgId, { tribunalId }),
        fetchJudicialDistricts(orgId, { tribunalId }),
      ]);
      if (!isApiFailure(unitsData)) {
        setCourtUnits(unitsData.courtUnits.filter((item) => item.active !== false));
      } else {
        setCourtUnits([]);
      }
      if (!isApiFailure(districtsData)) {
        setDistricts(districtsData.districts.filter((item) => item.active !== false));
      } else {
        setDistricts([]);
      }
      setCourtUnitId("");
      setDistrictId("");
    })();
  }, [orgId, tribunalId]);

  function toggleSubject(subjectId: string) {
    setSubjectIds((current) =>
      current.includes(subjectId)
        ? current.filter((id) => id !== subjectId)
        : [...current, subjectId],
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId) return;

    const cnj = validateCnjNumber(cnjNumber);
    if (!cnj.ok) {
      setError(cnj.message);
      return;
    }
    if (!tribunalId) {
      setError("Selecione o tribunal.");
      return;
    }

    setPending(true);
    setError(null);
    const primarySubjectId = subjectIds[0];
    const result = await createJudicialProcess(orgId, matterId, {
      cnjNumber: cnj.formatted,
      tribunalId,
      courtUnitId: courtUnitId || undefined,
      courtUnitText: courtUnitId ? undefined : courtUnitText.trim() || undefined,
      districtId: districtId || undefined,
      districtText: districtId ? undefined : districtText.trim() || undefined,
      proceduralClassId: proceduralClassId || undefined,
      primarySubjectId,
      subjectIds: subjectIds.length > 0 ? subjectIds : undefined,
      confidentialityLevel,
    });
    setPending(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível cadastrar o processo judicial."));
      return;
    }
    window.location.assign(`/app/casos/${matterId}/processos/${result.process.id}`);
  }

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Casos", href: "/app/casos" },
    { label: matterRef || matterTitle, href: `/app/casos/${matterId}` },
    { label: "Processos judiciais", href: `/app/casos/${matterId}/processos` },
    { label: "Novo processo" },
  ];

  if (loading) return <LoadingState label="Preparando formulário" />;

  if (!canCreate) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <Alert tone="error" title="Sem permissão">
          Você não tem permissão para cadastrar processos judiciais nesta organização.
        </Alert>
        <ButtonLink href={`/app/casos/${matterId}/processos`} variant="secondary">
          Voltar aos processos
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Cadastrar processo judicial"
        eyebrow={matterRef || undefined}
        description="Informe o número CNJ e os dados processuais disponíveis. A validação confirma o formato do número — não a existência do processo no tribunal."
      />

      <Alert tone="info" title="Origem: cadastro manual">
        Nesta etapa os processos são registrados manualmente. Não há integração com tribunais nem
        atualização automática de andamentos.
      </Alert>

      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}

      <form className="vj-card vj-stack" onSubmit={submit} aria-labelledby="judicial-form">
        <h2 id="judicial-form" className="vj-section-title">
          Identificação
        </h2>

        <FormField id="cnjNumber" label="Número CNJ" hint="Formato NNNNNNN-DD.AAAA.J.TR.OOOO">
          <Input
            id="cnjNumber"
            name="cnjNumber"
            required
            autoComplete="off"
            inputMode="numeric"
            value={cnjNumber}
            onChange={(event) => setCnjNumber(event.target.value)}
            aria-describedby="cnj-validation"
            placeholder="0000000-00.0000.0.00.0000"
          />
        </FormField>
        <p
          id="cnj-validation"
          className={cnjValidation?.ok ? "vj-meta" : "vj-field-error"}
          role={cnjValidation && !cnjValidation.ok ? "status" : undefined}
        >
          {cnjValidation
            ? cnjValidation.message
            : "A validação estrutural confirma “Número CNJ válido em formato”, sem afirmar existência no tribunal."}
        </p>

        <FormField id="tribunalId" label="Tribunal">
          <Select
            id="tribunalId"
            name="tribunalId"
            required
            value={tribunalId}
            onChange={(event) => setTribunalId(event.target.value)}
          >
            <option value="">Selecione</option>
            {courts.map((court) => (
              <option key={court.id} value={court.id}>
                {court.acronym} — {court.name}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="vj-split">
          <FormField
            id="courtUnitId"
            label="Vara / unidade"
            hint={
              courtUnits.length === 0
                ? "Catálogo sem unidades para este tribunal — use o texto abaixo."
                : "Se a unidade não estiver na lista, use o campo de texto."
            }
          >
            <Select
              id="courtUnitId"
              name="courtUnitId"
              value={courtUnitId}
              disabled={!tribunalId || courtUnits.length === 0}
              onChange={(event) => {
                setCourtUnitId(event.target.value);
                if (event.target.value) setCourtUnitText("");
              }}
            >
              <option value="">
                {courtUnits.length === 0 ? "Nenhuma unidade catalogada" : "Selecionar unidade"}
              </option>
              {courtUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="courtUnitText" label="Vara (texto)">
            <Input
              id="courtUnitText"
              name="courtUnitText"
              value={courtUnitText}
              disabled={Boolean(courtUnitId)}
              onChange={(event) => setCourtUnitText(event.target.value)}
              placeholder="Ex.: 1ª Vara Cível"
              maxLength={200}
            />
          </FormField>
        </div>

        <div className="vj-split">
          <FormField
            id="districtId"
            label="Comarca"
            hint={
              districts.length === 0
                ? "Catálogo sem comarcas — use o texto abaixo, se necessário."
                : undefined
            }
          >
            <Select
              id="districtId"
              name="districtId"
              value={districtId}
              disabled={!tribunalId || districts.length === 0}
              onChange={(event) => {
                setDistrictId(event.target.value);
                if (event.target.value) setDistrictText("");
              }}
            >
              <option value="">
                {districts.length === 0 ? "Nenhuma comarca catalogada" : "Selecionar comarca"}
              </option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                  {district.stateCode ? ` (${district.stateCode})` : ""}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="districtText" label="Comarca (texto)">
            <Input
              id="districtText"
              name="districtText"
              value={districtText}
              disabled={Boolean(districtId)}
              onChange={(event) => setDistrictText(event.target.value)}
              placeholder="Ex.: São Paulo"
              maxLength={200}
            />
          </FormField>
        </div>

        <FormField id="proceduralClassId" label="Classe processual">
          <Select
            id="proceduralClassId"
            name="proceduralClassId"
            value={proceduralClassId}
            onChange={(event) => setProceduralClassId(event.target.value)}
          >
            <option value="">Não informada</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code ? `${item.code} — ` : ""}
                {item.name}
              </option>
            ))}
          </Select>
        </FormField>

        <fieldset className="vj-stack">
          <legend className="vj-section-title" id="subjects-legend">
            Assuntos
          </legend>
          <p className="vj-meta">Selecione um ou mais assuntos. O primeiro será o principal.</p>
          {subjects.length === 0 ? (
            <p className="vj-meta">Nenhum assunto disponível no catálogo de referência.</p>
          ) : (
            <ul className="vj-stack" aria-labelledby="subjects-legend">
              {subjects.map((subject) => (
                <li key={subject.id}>
                  <label className="vj-inline-actions">
                    <input
                      type="checkbox"
                      checked={subjectIds.includes(subject.id)}
                      onChange={() => toggleSubject(subject.id)}
                    />
                    <span>
                      {subject.code ? `${subject.code} — ` : ""}
                      {subject.name}
                      {subjectIds[0] === subject.id ? (
                        <span className="vj-meta"> · principal</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <FormField id="confidentialityLevel" label="Confidencialidade">
          <Select
            id="confidentialityLevel"
            name="confidentialityLevel"
            value={confidentialityLevel}
            onChange={(event) =>
              setConfidentialityLevel(event.target.value as JudicialConfidentiality)
            }
          >
            {(Object.keys(CONFIDENTIALITY_LABELS) as JudicialConfidentiality[]).map((key) => (
              <option key={key} value={key}>
                {CONFIDENTIALITY_LABELS[key]}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="vj-form-actions">
          <Button type="submit" disabled={pending || !cnjValidation?.ok}>
            {pending ? "Salvando…" : "Cadastrar processo"}
          </Button>
          <ButtonLink href={`/app/casos/${matterId}/processos`} variant="secondary">
            Cancelar
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}
