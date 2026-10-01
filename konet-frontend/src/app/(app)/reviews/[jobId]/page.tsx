import { notFound } from "next/navigation";
import { getJobById } from "@/data/repositories/job.repository";
import { getSession } from "@/lib/auth/session";
import { ReviewForm } from "@/features/reviews/components/review-form";
type Props = { params: Promise<{ jobId: string }> };
export const metadata = { title: "Review job" };
export default async function Page({ params }: Props) {
  const [job, session] = await Promise.all([getJobById((await params).jobId), getSession()]);
  if (!job || job.clientId !== session?.userId) notFound();
  return <section className="workspace-page narrow"><div className="page-heading"><span className="eyebrow">Verified review</span><h1>How did the job go?</h1><p>Your review will be connected to this completed job.</p></div><div className="surface-panel">{job.status === "released" ? <ReviewForm jobId={job.id} /> : <p>{job.status === "reviewed" ? "You have already reviewed this job." : "Reviews are available after the completed work is approved."}</p>}</div></section>;
}
