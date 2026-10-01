import Link from "next/link";
import { getProviderRequests } from "@/data/repositories/job.repository";
import { getCurrentUser } from "@/data/repositories/user.repository";
export const metadata = { title: "Provider requests" };
export default async function Page() {
  const user = await getCurrentUser();
  const requests = user.providerProfileId ? await getProviderRequests(user.providerProfileId) : [];
  return <section className="provider-page"><div className="page-heading"><span className="eyebrow">Inbox</span><h1>Service requests</h1></div>
    {requests.length ? <div className="workspace-list">{requests.map(request => <Link href={`/provider/requests/${request.id}`} key={request.id}><div><strong>{request.service}</strong><p>{request.requestedDate} · {request.location} · {request.details}</p></div><span className="badge">{request.status}</span></Link>)}</div> : <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-[var(--muted)]">New service requests will appear here.</div>}
  </section>;
}
