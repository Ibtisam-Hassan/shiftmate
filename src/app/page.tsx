import { redirect } from "next/navigation";
import { getActor } from "@/server/authz/actor";

export default async function Home() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  redirect(actor.role === "EMPLOYEE" ? "/my-shifts" : "/home");
}
