import { DisputeDetail } from "@/features/disputes/components/dispute-workspace";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
export const metadata = { title: "Dispute details" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <section className="workspace-page">
      <PageHeader
        eyebrow="Resolution center"
        title="Dispute details"
        description="Review the case, its decision history and any payment resolution."
        action={<Button href="/disputes" variant="secondary">All disputes</Button>}
      />
      <DisputeDetail id={id} />
    </section>
  );
}
