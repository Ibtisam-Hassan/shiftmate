import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/server/authz/policy";

type Tx = Prisma.TransactionClient;

export function audit(
  tx: Tx,
  actor: Pick<Actor, "id"> | null,
  entry: { action: string; entity: string; entityId: string; locationId?: string | null; before?: unknown; after?: unknown },
) {
  return tx.auditLog.create({
    data: {
      actorId: actor?.id ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      locationId: entry.locationId ?? null,
      before: entry.before === undefined ? undefined : (JSON.parse(JSON.stringify(entry.before)) as Prisma.InputJsonValue),
      after: entry.after === undefined ? undefined : (JSON.parse(JSON.stringify(entry.after)) as Prisma.InputJsonValue),
    },
  });
}

export function notify(tx: Tx, userIds: string[], n: { type: string; title: string; body?: string; href?: string }) {
  const unique = [...new Set(userIds)];
  if (!unique.length) return Promise.resolve({ count: 0 });
  return tx.notification.createMany({ data: unique.map((userId) => ({ userId, ...n })) });
}
