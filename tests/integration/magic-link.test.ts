import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { canReceiveMagicLink } from "@/lib/email";
import { resetDemoData } from "@/server/demo/seed";

beforeAll(async () => {
  await resetDemoData(db, { now: new Date("2026-09-23T15:00:00Z") });
});

describe("magic-link sending", () => {
  it("sends only to existing, active accounts", async () => {
    expect(await canReceiveMagicLink("manager@demo.shiftmate.app")).toBe(true);
    expect(await canReceiveMagicLink("MANAGER@demo.shiftmate.app")).toBe(true);
    expect(await canReceiveMagicLink("nobody@example.com")).toBe(false);
    await db.user.update({ where: { email: "manager.riverside@demo.shiftmate.app" }, data: { status: "DEACTIVATED" } });
    expect(await canReceiveMagicLink("manager.riverside@demo.shiftmate.app")).toBe(false);
  });
});
