import { organizationClientUsers, type DatabaseExecutor } from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, eq } from "drizzle-orm";

export type ClientPortalContext = {
  userId: string;
  clientId: string;
  organizationId: string;
  organizationClientUserId: string;
};

export async function resolveClientPortalContext(
  db: Pick<DatabaseExecutor, "select">,
  userId: string,
  organizationId: string,
): Promise<ClientPortalContext> {
  const [row] = await db
    .select({
      id: organizationClientUsers.id,
      crmClientId: organizationClientUsers.crmClientId,
    })
    .from(organizationClientUsers)
    .where(
      and(
        eq(organizationClientUsers.userId, userId),
        eq(organizationClientUsers.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!row?.crmClientId) {
    throw new AppError(
      "NOT_FOUND",
      "Não encontramos vínculo de portal para este usuário nesta organização.",
    );
  }

  return {
    userId,
    organizationId,
    clientId: row.crmClientId,
    organizationClientUserId: row.id,
  };
}
