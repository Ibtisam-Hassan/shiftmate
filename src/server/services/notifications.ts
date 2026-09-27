import "server-only";
import { db } from "@/lib/db";
import type { Actor } from "@/server/authz/policy";

export async function unreadCount(actor: Actor) {
  return db.notification.count({ where: { userId: actor.id, readAt: null } });
}

export async function recentNotifications(actor: Actor) {
  const rows = await db.notification.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 20 });
  return rows.map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, unread: !n.readAt, at: n.createdAt.toISOString() }));
}

export async function markAllRead(actor: Actor) {
  await db.notification.updateMany({ where: { userId: actor.id, readAt: null }, data: { readAt: new Date() } });
}
