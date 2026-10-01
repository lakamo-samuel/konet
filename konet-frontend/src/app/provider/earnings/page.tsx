import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/data/repositories/user.repository";
import { getJobsForUser } from "@/data/repositories/job.repository";
import { getTransactionByJob } from "@/data/repositories/transaction.repository";
import { formatNaira } from "@/lib/formatters/currency";
export const metadata = { title: "Provider earnings" };
export default async function Page() {
  const user = await getCurrentUser();
  const jobs = (await getJobsForUser(user.id)).filter(job => job.providerId === user.providerProfileId);
  const rows = (await Promise.all(jobs.map(async job => ({ job, transaction: await getTransactionByJob(job.id) })))).filter(row => row.transaction);
  const protectedTotal = rows.filter(row => row.transaction?.status === "protected").reduce((sum, row) => sum + (row.transaction?.amount ?? 0), 0);
  const releasedTotal = rows.filter(row => row.transaction?.status === "released").reduce((sum, row) => sum + (row.transaction?.amount ?? 0), 0);
  return <section className="provider-page earnings-page"><div className="page-heading provider-heading"><div><span className="eyebrow">Payments</span><h1>Earnings</h1><p>Track protected payments and released funds.</p></div></div>
    <div className="earnings-hero"><div><span>Protected in active jobs</span><strong>{formatNaira(protectedTotal)}</strong><small>Pending client approval</small></div><div><span>Released payments</span><strong>{formatNaira(releasedTotal)}</strong><small>Across completed jobs</small></div><div><span>Recorded payments</span><strong>{rows.length}</strong><small>Job transactions</small></div></div>
    <section className="workspace-card"><div className="workspace-card-heading"><div><span className="eyebrow muted">Activity</span><h2>Recent transactions</h2></div></div>
      {rows.length ? rows.map(({ job, transaction }) => <div className="transaction-row" key={job.id}><div className={`transaction-icon ${transaction?.status === "released" ? "released" : ""}`}>{transaction?.status === "released" ? "✓" : "↓"}</div><div><strong>{job.service}</strong><p>Job payment</p></div><span>{job.date}</span><b>{formatNaira(transaction?.amount ?? job.amount)}</b><Badge tone={transaction?.status === "released" ? "neutral" : undefined}>{transaction?.status ?? "unfunded"}</Badge></div>) : <p className="py-7 text-sm text-[var(--muted)]">Payment activity will appear here after a client funds a job.</p>}
    </section>
  </section>;
}
