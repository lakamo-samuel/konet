import Link from "next/link";
import { ProviderCard } from "@/features/providers/components/provider-card";
import { SearchForm } from "@/features/discovery/components/search-form";
import { getProviders, searchProviders } from "@/data/repositories/provider.repository";
import { getUniversities } from "@/data/repositories/university.repository";

export const metadata = { title: "Discover" };
const categories = ["Photography", "Barbering", "Design", "Tutoring", "Beauty", "Technology"];

type Props = { searchParams: Promise<{ q?: string; campus?: string }> };
export default async function Page({ searchParams }: Props) {
  const { q = "", campus = "" } = await searchParams;
  const hasFilters = Boolean(q.trim() || campus);
  const [providers, universities] = await Promise.all([
    hasFilters ? searchProviders({ query: q, universityId: campus }) : getProviders(),
    getUniversities(),
  ]);
  const card = (provider: (typeof providers)[number]) => {
    const university = universities.find(item => item.id === provider.universityId);
    return university ? <ProviderCard key={provider.id} provider={provider} university={university} /> : null;
  };
  return <section className="content-width app-section discover-home">
    <div className="discover-welcome">
      <span className="eyebrow">Discover student talent</span>
      <h1>{hasFilters ? "Find the right person for the job." : <>Find your next <em>great collaborator.</em></>}</h1>
      <p>Explore trusted services across campuses and compare work, reviews, and starting prices.</p>
      <SearchForm universities={universities} defaultQuery={q} defaultCampus={campus} />
    </div>
    <nav className="category-row" aria-label="Popular services">
      {categories.map(category => <Link className="category" href={`/discover?q=${encodeURIComponent(category)}`} key={category}>{category}</Link>)}
    </nav>
    {hasFilters ? <section className="discover-block" aria-live="polite">
      <div className="section-heading"><div><span className="eyebrow muted">Search results</span><h2>{q ? `Results for “${q}”` : "Providers at your campus"}</h2><p>{providers.length} provider{providers.length === 1 ? "" : "s"} found</p></div><Link href="/discover">Clear filters</Link></div>
      {providers.length ? <div className="provider-grid">{providers.map(card)}</div> : <div className="empty-state"><h2>No providers match yet</h2><p>Try another service or search across all campuses.</p></div>}
    </section> : <>
      <section className="discover-block"><div className="section-heading"><div><span className="eyebrow muted">Explore</span><h2>Student providers</h2><p>Compare trusted work and choose who fits your project.</p></div></div><div className="provider-grid">{providers.map(card)}</div></section>
      <section className="discover-block"><div className="section-heading"><div><span className="eyebrow muted">Available now</span><h2>Ready for new requests</h2></div></div><div className="provider-grid rising-grid">{providers.filter(item => item.available).slice(0, 3).map(card)}</div></section>
    </>}
  </section>;
}
