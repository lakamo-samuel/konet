import Link from "next/link";
import { getServicesByProvider } from "@/data/repositories/provider.repository";
import { getCurrentUser } from "@/data/repositories/user.repository";
import { formatNaira } from "@/lib/formatters/currency";
import { Button } from "@/components/ui/button";
export const metadata = { title: "Provider services" };
export default async function Page() {
  const user = await getCurrentUser();
  const services = user.providerProfileId ? await getServicesByProvider(user.providerProfileId) : [];
  return <section className="provider-page"><div className="page-heading row-heading"><div><span className="eyebrow">Your offer</span><h1>Services</h1></div><Button href="/provider/services/new">Add service</Button></div>
    {services.length ? <div className="workspace-list">{services.map(service => <Link href={`/provider/services/${service.id}`} key={service.id}><div><strong>{service.name}</strong><p>{service.description}</p></div><b>{formatNaira(service.startingPrice)}</b></Link>)}</div> : <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8"><h2 className="text-xl font-bold">Add your first service</h2><p className="mt-2 text-[var(--muted)]">Describe what clients can book and set a clear starting price.</p></div>}
  </section>;
}
