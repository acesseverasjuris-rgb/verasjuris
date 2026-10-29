"use client";

import { Breadcrumb, Button, ErrorState, Input, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { EDUCATION_APP_TABS, TracksList } from "../../../../components/education-ui";
import {
  createLearningTrack,
  educationErrorMessage,
  fetchEducationTracks,
  hasEducationPermission,
  isApiFailure,
  type EducationTrack,
} from "../../../../lib/education";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function AppTrilhasPage() {
  const org = useOrgContext();
  const can = hasEducationPermission(org.permissions, "read");
  const canManage = hasEducationPermission(org.permissions, "track.manage");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<EducationTrack[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!org.ready || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchEducationTracks({
        organizationId: org.orgId ?? undefined,
        limit: 50,
      });
      if (cancelled) return;
      if (isApiFailure(res)) setError(educationErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>Sem permissão para trilhas.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Educação", href: "/app/educacao" }, { label: "Trilhas" }]} />
      <PageHeader title="Trilhas" description="Trilhas de aprendizagem da organização." />
      <SectionTabs label="Seções" items={EDUCATION_APP_TABS} current="/app/educacao/trilhas" />
      {loading ? <LoadingState label="Carregando trilhas…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <TracksList items={items} /> : null}
      {canManage && org.orgId ? (
        <form
          className="vj-inline-actions"
          onSubmit={(e) => {
            e.preventDefault();
            if (!org.orgId || !title.trim()) return;
            setBusy(true);
            void createLearningTrack(org.orgId, {
              title: title.trim(),
              status: "draft",
              visibility: "organization_only",
            }).then((res) => {
              setBusy(false);
              if (isApiFailure(res)) setError(educationErrorMessage(res));
              else {
                setTitle("");
                setItems((prev) => [...prev, res.track]);
              }
            });
          }}
        >
          <Input
            aria-label="Título da trilha"
            value={title}
            onChange={(ev) => setTitle(ev.target.value)}
            required
          />
          <Button type="submit" disabled={busy}>
            Criar trilha
          </Button>
        </form>
      ) : null}
    </div>
  );
}
