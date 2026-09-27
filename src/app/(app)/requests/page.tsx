import { PageHeader } from "@/components/page-header";
import { requireActor } from "@/server/authz/actor";

export const metadata = { title: "Requests" };

export default async function Page() {
  await requireActor();
  return <PageHeader title="Requests" description="Coming in a later milestone." />;
}
