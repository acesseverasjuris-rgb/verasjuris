import { controlEmployees, type AppDatabase } from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, eq } from "drizzle-orm";

export async function requireEmployeeInOrg(
  db: AppDatabase,
  organizationId: string,
  employeeId: string,
) {
  const [row] = await db
    .select()
    .from(controlEmployees)
    .where(
      and(eq(controlEmployees.id, employeeId), eq(controlEmployees.organizationId, organizationId)),
    )
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este colaborador no seu acesso.");
  return row;
}
