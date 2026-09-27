import { PageHeader } from "@/components/page-header";
import { requireActor } from "@/server/authz/actor";

export const metadata = { title: "Availability" };

export default async function Page() {
  await requireActor();
  return <PageHeader title="Availability" description="Coming in a later milestone." />;
}
