import { PageHeader } from "@/components/page-header";
import { requireActor } from "@/server/authz/actor";

export const metadata = { title: "Settings" };

export default async function Page() {
  await requireActor();
  return <PageHeader title="Settings" description="Coming in a later milestone." />;
}
