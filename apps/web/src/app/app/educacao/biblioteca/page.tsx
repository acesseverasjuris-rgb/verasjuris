"use client";

import { Breadcrumb, Button, ErrorState, Input, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { EDUCATION_APP_TABS, LibraryList } from "../../../../components/education-ui";
import {
  createLibraryItem,
  educationErrorMessage,
  fetchEducationLibrary,
  hasEducationPermission,
  isApiFailure,
  type EducationLibraryItem,
} from "../../../../lib/education";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function AppBibliotecaPage() {
  const org = useOrgContext();
  const can = hasEducationPermission(org.permissions, "read");
  const canManage = hasEducationPermission(org.permissions, "library.manage");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<EducationLibraryItem[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!org.ready || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchEducationLibrary({
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
    return <NoPermission>Sem permissão para a biblioteca.</NoPermission>;
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Educação", href: "/app/educacao" }, { label: "Biblioteca" }]} />
      <PageHeader
        title="Biblioteca jurídica"
        description="Materiais de referência da organização."
      />
      <SectionTabs label="Seções" items={EDUCATION_APP_TABS} current="/app/educacao/biblioteca" />
      {loading ? <LoadingState label="Carregando biblioteca…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <LibraryList items={items} /> : null}
      {canManage && org.orgId ? (
        <form
          className="vj-inline-actions"
          onSubmit={(e) => {
            e.preventDefault();
            if (!org.orgId || !title.trim()) return;
            setBusy(true);
            void createLibraryItem(org.orgId, {
              title: title.trim(),
              itemType: "document",
              source: "authored_internally",
              visibility: "organization_only",
            }).then((res) => {
              setBusy(false);
              if (isApiFailure(res)) setError(educationErrorMessage(res));
              else {
                setTitle("");
                setItems((prev) => [...prev, res.item]);
              }
            });
          }}
        >
          <Input
            aria-label="Título do item"
            value={title}
            onChange={(ev) => setTitle(ev.target.value)}
            required
          />
          <Button type="submit" disabled={busy}>
            Adicionar item
          </Button>
        </form>
      ) : null}
    </div>
  );
}
