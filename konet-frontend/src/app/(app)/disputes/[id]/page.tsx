import { DisputeDetail } from "@/features/disputes/components/dispute-workspace";
export const metadata = { title: "Dispute details" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <section className="workspace-page narrow">
      <h1>Dispute details</h1>
      <DisputeDetail id={id} />
    </section>
  );
}
