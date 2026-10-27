import { eq } from "drizzle-orm";
import { loadDotEnv, parseSeedEnv } from "@verasjuris/config";
import { hashPassword } from "@verasjuris/security";
import {
  PERMISSION_DESCRIPTIONS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SYSTEM_ROLE_KEYS,
  SYSTEM_ROLE_NAMES,
  type PermissionKey,
  type SystemRoleKey,
} from "@verasjuris/types";
import type { AppDatabase } from "./client.js";
import {
  permissions,
  professionalProfiles,
  profiles,
  rolePermissions,
  roles,
  users,
} from "./schema/index.js";

function referenceId(sequence: number): string {
  return `10000000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`;
}

const PERMISSION_IDS = Object.fromEntries(
  PERMISSIONS.map((key, index) => [key, referenceId(index + 1)]),
) as Record<PermissionKey, string>;

const ROLE_IDS: Record<SystemRoleKey, string> = {
  owner: referenceId(101),
  administrator: referenceId(102),
  member: referenceId(103),
};

const ROLE_DESCRIPTIONS: Record<SystemRoleKey, string> = {
  owner: "Responsável pela organização e pela atribuição de papéis.",
  administrator: "Administra participantes e consulta a auditoria, sem atribuir papéis.",
  member: "Consulta a organização e os participantes.",
};

export async function seedReferenceData(db: AppDatabase): Promise<void> {
  for (const key of PERMISSIONS) {
    const existing = await db.query.permissions.findFirst({ where: eq(permissions.key, key) });
    if (!existing) {
      await db.insert(permissions).values({
        id: PERMISSION_IDS[key],
        key,
        description: PERMISSION_DESCRIPTIONS[key],
      });
    }
  }

  for (const key of SYSTEM_ROLE_KEYS) {
    const existing = await db.query.roles.findFirst({ where: eq(roles.key, key) });
    if (!existing) {
      await db.insert(roles).values({
        id: ROLE_IDS[key],
        key,
        name: SYSTEM_ROLE_NAMES[key],
        description: ROLE_DESCRIPTIONS[key],
        isSystem: true,
      });
    }
  }

  for (const roleKey of SYSTEM_ROLE_KEYS) {
    const role = await db.query.roles.findFirst({ where: eq(roles.key, roleKey) });
    if (!role) continue;
    for (const permissionKey of ROLE_PERMISSIONS[roleKey]) {
      const permission = await db.query.permissions.findFirst({
        where: eq(permissions.key, permissionKey),
      });
      if (!permission) continue;
      const link = await db.query.rolePermissions.findFirst({
        where: (table, { and, eq: equals }) =>
          and(equals(table.roleId, role.id), equals(table.permissionId, permission.id)),
      });
      if (!link) {
        await db.insert(rolePermissions).values({ roleId: role.id, permissionId: permission.id });
      }
    }
  }
}

export async function assertReferenceData(db: AppDatabase): Promise<void> {
  const owner = await db.query.roles.findFirst({ where: eq(roles.key, "owner") });
  if (!owner) {
    throw new Error("Os papéis de referência não estão no banco. Execute pnpm db:seed.");
  }
}

export async function seedDevelopmentUser(
  db: AppDatabase,
): Promise<"skipped" | "created" | "exists"> {
  loadDotEnv();
  const env = parseSeedEnv(process.env);
  const name = env.SEED_USER_NAME.trim();
  const email = env.SEED_USER_EMAIL.trim().toLowerCase();
  const password = env.SEED_USER_PASSWORD;
  if (!name && !email && !password) return "skipped";
  if (!name || !email || password.length < 12) {
    throw new Error(
      "Para criar o usuário de desenvolvimento, informe SEED_USER_NAME, SEED_USER_EMAIL e SEED_USER_PASSWORD com pelo menos 12 caracteres.",
    );
  }
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return "exists";
  const passwordHash = await hashPassword(password);
  const now = new Date();
  await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        status: "active",
        emailVerifiedAt: now,
      })
      .returning({ id: users.id });
    if (!user) throw new Error("Não foi possível criar o usuário de desenvolvimento.");
    await tx.insert(profiles).values({ userId: user.id, displayName: name });
    await tx.insert(professionalProfiles).values({ userId: user.id });
  });
  return "created";
}

export async function seed(db: AppDatabase): Promise<void> {
  await seedReferenceData(db);
  const user = await seedDevelopmentUser(db);
  console.info(`Seed de referência concluído. Usuário de desenvolvimento: ${user}.`);
}
