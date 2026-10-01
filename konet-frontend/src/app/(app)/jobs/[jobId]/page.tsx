import { notFound } from "next/navigation";
import { getJobById } from "@/data/repositories/job.repository";
import { getTransactionByJob } from "@/data/repositories/transaction.repository";
import { getConversationsForUser } from "@/data/repositories/message.repository";
import { getSession } from "@/lib/auth/session";
import { formatNaira } from "@/lib/formatters/currency";
import { Button } from "@/components/ui/button";
import { ReleaseButton } from "@/features/jobs/components/release-button";
type Props = { params: Promise<{ jobId: string }> };
export const metadata = { title: "Job workspace" };
const stages = ["Agreed", "Funded", "In progress", "Delivered", "Complete"];
export default async function Page({ params }: Props) {
  const job = await getJobById((await params).jobId);
  const session = await getSession();
  if (!job || !session || (job.clientId !== session.userId && job.providerId !== session.providerProfileId)) notFound();
  const [txn, conversations] = await Promise.all([getTransactionByJob(job.id), getConversationsForUser(session.userId)]);
  const conversation = conversations.find(item => item.jobId === job.id);
  const stage = job.status === "requested" || job.status === "quoted" ? 0 : job.status === "funded" ? 1 : job.status === "in_progress" ? 2 : job.status === "delivered" ? 3 : 4;
  const client = job.clientId === session.userId;
  return <section className="content-width app-section"><div className="page-heading"><span className="eyebrow">Job workspace</span><h1>{job.service}</h1><p>{job.date} at {job.time} · {job.location}</p></div><div className="job-workspace"><div className="surface-panel"><h2>Progress</h2><ol className="job-timeline">{stages.map((label, index) => <li className={index <= stage ? "done" : ""} key={label}><span>{index <= stage ? "✓" : index + 1}</span><small>{label}</small></li>)}</ol><h2>Job details</h2><p>Use messages to confirm logistics and keep decisions connected to this job.</p><div className="action-row">{conversation && <Button href={`/messages/${conversation.id}`}>Open messages</Button>}{client && ["released", "reviewed"].includes(job.status) && <Button href={`/reviews/${job.id}`} variant="secondary">Review completed work</Button>}</div></div><aside className="surface-panel job-payment-panel"><span>Protected amount</span><strong className="protected-amount">{formatNaira(txn?.amount ?? job.amount)}</strong><span className="badge">{txn?.status ?? "unfunded"}</span><p>Release funds after you have reviewed and accepted the delivery.</p>{client && <ReleaseButton jobId={job.id} ready={job.status === "delivered"} />}</aside></div></section>;
}
