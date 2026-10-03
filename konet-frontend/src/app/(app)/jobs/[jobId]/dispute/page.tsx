import { OpenDispute } from "@/features/disputes/components/dispute-workspace";
export const metadata = { title: "Open a dispute" };
export default async function Page({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return (
    <section className="workspace-page narrow">
      <h1>Open a dispute</h1>
      <OpenDispute jobId={jobId} />
    </section>
  );
}
