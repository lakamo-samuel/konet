import { JobWorkspace } from "@/features/hiring/components/job-workspace";
export const metadata = { title: "Job workspace" };
export default async function Page({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return (
    <section className="workspace-page narrow">
      <h1>Job workspace</h1>
      <JobWorkspace id={jobId} />
    </section>
  );
}
