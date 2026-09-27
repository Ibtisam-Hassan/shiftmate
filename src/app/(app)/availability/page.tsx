import { PageHeader } from "@/components/page-header";
import { requireActor } from "@/server/authz/actor";
import { myUnavailability } from "@/server/services/availability";
import { AvailabilityEditor } from "./availability-editor";

export const metadata = { title: "Availability" };

export default async function AvailabilityPage() {
  const actor = await requireActor();
  return (
    <>
      <PageHeader title="Availability" description="Tell your manager when you cannot work each week. This applies from today." />
      <AvailabilityEditor initial={await myUnavailability(actor)} />
    </>
  );
}
