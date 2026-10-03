import { ReviewWorkspace } from "@/features/reviews/components/review-workspace";
export const metadata = { title: "Job review" };
export default async function Page({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return (
    <section className="workspace-page narrow">
      <div className="page-heading">
        <span className="eyebrow">Job feedback</span>
        <h1>Review the completed job.</h1>
      </div>
      <ReviewWorkspace jobId={jobId} />
    </section>
  );
}
