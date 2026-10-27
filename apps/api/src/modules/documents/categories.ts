import { documentCategories, type AppDatabase } from "@verasjuris/database";
import { and, eq } from "drizzle-orm";

type CatalogDb = Pick<AppDatabase, "query" | "insert">;

const DEFAULT_CATEGORIES = [
  { name: "Contrato", slug: "contrato", sortOrder: 10 },
  { name: "Petição", slug: "peticao", sortOrder: 20 },
  { name: "Procuração", slug: "procuracao", sortOrder: 30 },
  { name: "Prova", slug: "prova", sortOrder: 40 },
  { name: "Protocolo", slug: "protocolo", sortOrder: 50 },
  { name: "Decisão", slug: "decisao", sortOrder: 60 },
  { name: "Outros", slug: "outros", sortOrder: 100 },
] as const;

export async function ensureDocumentCategories(
  db: CatalogDb,
  organizationId: string,
): Promise<void> {
  for (const category of DEFAULT_CATEGORIES) {
    const existing = await db.query.documentCategories.findFirst({
      where: and(
        eq(documentCategories.organizationId, organizationId),
        eq(documentCategories.slug, category.slug),
      ),
    });
    if (!existing) {
      await db.insert(documentCategories).values({
        organizationId,
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
        active: true,
      });
    }
  }
}
