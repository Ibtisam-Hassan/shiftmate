import { PageHeader } from "@/components/page-header";
import { requireActor } from "@/server/authz/actor";

export const metadata = { title: "Labor" };

export default async function Page() {
  await requireActor();
  return <PageHeader title="Labor" description="Coming in a later milestone." />;
}
