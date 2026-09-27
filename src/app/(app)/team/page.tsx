import { PageHeader } from "@/components/page-header";
import { requireActor } from "@/server/authz/actor";

export const metadata = { title: "Team" };

export default async function Page() {
  await requireActor();
  return <PageHeader title="Team" description="Coming in a later milestone." />;
}
