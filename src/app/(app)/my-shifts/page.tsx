import { PageHeader } from "@/components/page-header";
import { requireActor } from "@/server/authz/actor";

export const metadata = { title: "My Shifts" };

export default async function Page() {
  await requireActor();
  return <PageHeader title="My Shifts" description="Coming in a later milestone." />;
}
