import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/data/repositories/user.repository";
import { getProviderById } from "@/data/repositories/provider.repository";
import { getProviderRequests, getJobsForUser } from "@/data/repositories/job.repository";
import { formatNaira } from "@/lib/formatters/currency";
export const metadata = { title: "Provider dashboard" };
export default async function Page() {
  const user = await getCurrentUser();
  const providerId = user.providerProfileId;
  if (!providerId) return <section className="provider-page"><h1>Build your provider profile</h1><p className="mt-3 text-[var(--muted)]">Complete your profile to start offering services.</p><Button href="/provider/onboarding" className="mt-6">Get started</Button></section>;
  const [provider, requests, allJobs] = await Promise.all([getProviderById(providerId), getProviderRequests(providerId), getJobsForUser(user.id)]);
  const jobs = allJobs.filter(job => job.providerId === providerId);
  const newRequest = requests.find(request => request.status === "pending") ?? requests[0];
  const activeJob = jobs.find(job => !["released", "reviewed"].includes(job.status));
  const name = user.name.split(" ")[0];
  return <section className="provider-page dashboard-page">
    <div className="page-heading provider-heading"><div><span className="eyebrow">Provider workspace</span><h1>Welcome back, {name}.</h1><p>Here is what needs your attention today.</p></div><Button href={`/providers/${providerId}`} variant="secondary">View public profile</Button></div>
    <div className="dashboard-metrics"><div><span>Active jobs</span><strong>{jobs.filter(job => !["released", "reviewed"].includes(job.status)).length}</strong><small>Jobs in progress</small></div><div><span>Completed jobs</span><strong>{provider?.reputation.completedJobs ?? 0}</strong><small>{provider?.reputation.completionRate ?? 0}% completion</small></div><div><span>Average rating</span><strong>{provider?.reputation.rating ? provider.reputation.rating.toFixed(1) : "—"}</strong><small>{provider?.reputation.reviewCount ?? 0} verified reviews</small></div><div><span>New requests</span><strong>{requests.filter(request => request.status === "pending").length}</strong><small>Awaiting response</small></div></div>
    <div className="dashboard-layout"><main>
      <section className="workspace-card"><div className="workspace-card-heading"><div><span className="eyebrow muted">Service requests</span><h2>{newRequest ? newRequest.service : "Ready for your first request"}</h2></div>{newRequest && <Badge tone="amber">{newRequest.status === "pending" ? "Needs response" : newRequest.status}</Badge>}</div>{newRequest ? <><p className="my-5 text-[var(--muted)]">{newRequest.details}</p><p className="mb-5 text-sm">{newRequest.requestedDate} · {newRequest.location} · {formatNaira(newRequest.budgetMin)}–{formatNaira(newRequest.budgetMax)}</p><Button href={`/provider/requests/${newRequest.id}`}>Review request</Button></> : <><p className="my-5 text-[var(--muted)]">Students will see your service and send their briefs here.</p><Button href="/provider/services" variant="secondary">View services</Button></>}</section>
      <section className="workspace-card"><div className="workspace-card-heading"><div><span className="eyebrow muted">Your work</span><h2>{activeJob ? activeJob.service : "No active jobs yet"}</h2></div>{activeJob && <Badge>{activeJob.status.replaceAll("_", " ")}</Badge>}</div>{activeJob ? <><p className="my-5 text-sm text-[var(--muted)]">{activeJob.date} · {activeJob.time} · {activeJob.location}</p><Button href={`/jobs/${activeJob.id}`} variant="secondary">Open job workspace</Button></> : <p className="my-5 text-[var(--muted)]">Accepted jobs will appear here with their agreed scope and payment status.</p>}</section>
    </main><aside><section className="workspace-card"><span className="eyebrow muted">Your reputation</span><h2>Build trust through real work.</h2><div className="performance-list"><span><b>{provider?.reputation.reviewCount ?? 0}</b> verified reviews</span><span><b>{provider?.reputation.repeatClients ?? 0}</b> repeat clients</span><span><b>{provider?.reputation.unresolvedDisputes ?? 0}</b> unresolved disputes</span></div><Link href={`/providers/${providerId}`}>View your public profile →</Link></section><section className="workspace-card"><span className="eyebrow muted">Keep your offer current</span><h2>Show what you do best.</h2><p>Update your service details and work examples as your experience grows.</p><Link href="/provider/portfolio">Update portfolio →</Link></section></aside></div>
  </section>;
}
