/**
 * Pure permission rules. Every service call goes through these; pages only hide what the
 * service would refuse anyway.
 */
export type Role = "ADMIN" | "MANAGER" | "EMPLOYEE";

export interface Actor {
  id: string;
  name: string;
  email: string;
  role: Role;
  isDemo: boolean;
  /** Set only for managers. */
  managedLocationId: string | null;
  /** Stores the actor may be scheduled at (employees and managers). */
  memberLocationIds: string[];
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have access to that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function canManageLocation(actor: Actor, locationId: string): boolean {
  if (actor.role === "ADMIN") return true;
  return actor.role === "MANAGER" && actor.managedLocationId === locationId;
}

export function assertCanManageLocation(actor: Actor, locationId: string): void {
  if (!canManageLocation(actor, locationId)) throw new ForbiddenError();
}

export function assertAdmin(actor: Actor): void {
  if (actor.role !== "ADMIN") throw new ForbiddenError();
}

/** Can the actor see this store's schedule at all (published weeks for employees)? */
export function canViewLocation(actor: Actor, locationId: string): boolean {
  return canManageLocation(actor, locationId) || actor.memberLocationIds.includes(locationId);
}

/** Locations the actor manages; `null` means all (admin). */
export function managedLocationIds(actor: Actor): string[] | null {
  if (actor.role === "ADMIN") return null;
  if (actor.role === "MANAGER" && actor.managedLocationId) return [actor.managedLocationId];
  return [];
}

/**
 * Managing an employee means they work at one of your stores. Managers can't edit admins or
 * other managers.
 */
export function canManageEmployee(
  actor: Actor,
  target: { id: string; role: Role; locationIds: string[] },
): boolean {
  if (actor.role === "ADMIN") return true;
  if (actor.role !== "MANAGER" || target.role !== "EMPLOYEE") return false;
  return target.locationIds.includes(actor.managedLocationId ?? "");
}
