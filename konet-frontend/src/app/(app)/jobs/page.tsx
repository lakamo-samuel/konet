import Link from "next/link";
import { getJobsForUser } from "@/data/repositories/job.repository";
import { getSession } from "@/lib/auth/session";
import { formatNaira } from "@/lib/formatters/currency";
export const metadata = { title: "Jobs" };
export default async function Page() {
  const session = await getSession();
  const jobs = session ? await getJobsForUser(session.userId) : [];
  return <section className="content-width app-section"><div className="page-heading"><span className="eyebrow">Your work</span><h1>Jobs and requests</h1><p>Track agreements, delivery, protected payment, and reviews.</p></div>
    {jobs.length ? <div className="workspace-list">{jobs.map(job => <Link href={`/jobs/${job.id}`} key={job.id}><div><strong>{job.service}</strong><p>{job.date} · {job.location}</p></div><span className="badge">{job.status.replaceAll("_", " ")}</span><b>{formatNaira(job.amount)}</b></Link>)}</div> : <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8"><h2 className="text-xl font-bold">No jobs yet</h2><p className="mt-2 text-[var(--muted)]">When you accept a quote, your jobs will appear here.</p><Link href="/discover" className="mt-4 inline-block font-bold text-[var(--clay)]">Discover providers →</Link></div>}
  </section>;
}
