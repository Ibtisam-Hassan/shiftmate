import { PageHeader } from "@/components/page-header";
import { requireActor } from "@/server/authz/actor";
import { myUnavailability } from "@/server/services/availability";
import { myUpcomingShifts } from "@/server/services/my-shifts";
import { AvailabilityEditor } from "./availability-editor";

export const metadata = { title: "Availability" };

export default async function AvailabilityPage() {
  const actor = await requireActor();
  return (
    <>
      <PageHeader title="Availability" description="Tell your manager when you cannot work each week. This applies from today." />
      <AvailabilityEditor
        initial={await myUnavailability(actor)}
        shifts={(await myUpcomingShifts(actor)).map((x) => ({ id: x.id, day: x.day, startMin: x.startMin, endMin: x.endMin, store: x.store }))}
      />
    </>
  );
}
