import Image from "next/image";
import { getPortfolioByProvider } from "@/data/repositories/provider.repository";
import { getCurrentUser } from "@/data/repositories/user.repository";
export const metadata = { title: "Provider portfolio" };
export default async function Page() {
  const user = await getCurrentUser();
  const items = user.providerProfileId ? await getPortfolioByProvider(user.providerProfileId) : [];
  return <section className="provider-page"><div className="page-heading"><span className="eyebrow">Proof of work</span><h1>Portfolio</h1><p>Keep your strongest and most relevant work visible.</p></div>
    {items.length ? <div className="work-grid">{items.map(item => <article className="surface-panel" key={item.id}><Image unoptimized src={item.image} alt={item.alt} width={640} height={480} /><h2>{item.title}</h2><p className="text-sm text-[var(--muted)]">{item.category}</p></article>)}</div> : <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-[var(--muted)]">Your work examples will appear here when they are published.</div>}
  </section>;
}
