import Image from "next/image";
import Link from "next/link";
import type { ProviderProfile, University } from "@/types/domain";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Icon from "@/components/ui/icon";
import { formatNaira } from "@/lib/formatters/currency";
export function ProviderCard({ provider, university }: { provider: ProviderProfile; university: University }) {
  const name = provider.fullName ?? provider.id[0].toUpperCase() + provider.id.slice(1);
  return <article className="provider-card"><Link className="provider-image" href={`/providers/${provider.id}`}>
    {provider.coverImage ? <Image unoptimized src={provider.coverImage} alt={`${provider.category} work by ${name}`} width={720} height={560} /> : <span className="block aspect-[9/7] bg-gradient-to-br from-[#d7c7b8] to-[#a48773]" role="img" aria-label={`${name}'s portfolio`} />}
    {provider.available && <span className="availability"><span />Available today</span>}<span className="portfolio-label">{provider.category}</span>
  </Link><div className="provider-body"><div className="provider-identity"><Avatar src={provider.avatar} name={name} /><div><Link className="name-button" href={`/providers/${provider.id}`}>{name}{provider.verification.identity === "verified" && <Icon name="verified" size={16} />}</Link><p>{provider.professionalTitle}</p></div></div><div className="provider-location"><Icon name="pin" size={14} />{university.shortName} <span>·</span> {provider.campus}</div><div className="card-reputation"><span><Icon name="star" size={14} /><b>{provider.reputation.reviewCount ? provider.reputation.rating.toFixed(1) : "New"}</b><span>({provider.reputation.reviewCount})</span></span><span>{provider.reputation.completedJobs} jobs completed</span></div><div className="card-bottom"><span>From <strong>{formatNaira(provider.startingPrice)}</strong></span><Link href={`/providers/${provider.id}`}>View profile<Icon name="arrow" size={17} /></Link></div><div className="card-trust">{provider.verification.identity === "verified" && <Badge>Identity verified</Badge>}{provider.verification.work === "verified" && <Badge icon="eye" tone="neutral">Work reviewed</Badge>}</div></div></article>;
}
