import type {Metadata} from "next";
import Image from "next/image";
import {notFound} from "next/navigation";
import {Avatar} from "@/components/ui/avatar";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {getProviderById,getPortfolioByProvider,getReviewsByProvider,getServicesByProvider} from "@/data/repositories/provider.repository";
import {getUniversityById} from "@/data/repositories/university.repository";
import {getConversationsForUser} from "@/data/repositories/message.repository";
import {getSession} from "@/lib/auth/session";
import {formatNaira} from "@/lib/formatters/currency";

type Props={params:Promise<{providerId:string}>};
const displayName=(provider:{id:string;fullName?:string})=>provider.fullName??provider.id[0].toUpperCase()+provider.id.slice(1);
export async function generateMetadata({params}:Props):Promise<Metadata>{const provider=await getProviderById((await params).providerId);return {title:provider?`${displayName(provider)} — ${provider.professionalTitle}`:"Provider",description:provider?.bio}}

export default async function Page({params}:Props){
  const provider=await getProviderById((await params).providerId);if(!provider)notFound();
  const [university,services,portfolio,reviews,session]=await Promise.all([getUniversityById(provider.universityId),getServicesByProvider(provider.id),getPortfolioByProvider(provider.id),getReviewsByProvider(provider.id),getSession()]);
  const conversations=session?await getConversationsForUser(session.userId):[];
  const conversation=conversations.find(item=>item.participantIds.includes(provider.userId));
  const name=displayName(provider);
  return <section className="content-width app-section">
    <div className="profile-gallery">
      {provider.coverImage?<Image unoptimized priority src={provider.coverImage} alt={`${provider.category} work by ${name}`} fill sizes="(max-width: 700px) 100vw, 66vw"/>:<div className="h-full w-full bg-gradient-to-br from-[#d7c7b8] to-[#a48773]"/>}
      {portfolio.length>1&&<div>{portfolio.slice(0,2).map(item=><Image unoptimized key={item.id} src={item.image} alt={item.alt} width={500} height={300}/>)}</div>}
      <span className="gallery-caption">Selected work</span>
    </div>
    <div className="profile-hero"><Avatar src={provider.avatar} name={name} size={160}/><div className="profile-title"><h1>{name}</h1><p>{provider.professionalTitle}</p><span>{university?.shortName} · {provider.campus}</span></div><div className="profile-hero-actions"><Button href={`/requests/${provider.id}`}>Request a service</Button></div></div>
    <div className="trust-summary"><div><strong>★ {provider.reputation.rating}</strong><span>{provider.reputation.reviewCount} reviews</span></div><div><strong>{provider.reputation.completedJobs}</strong><span>completed jobs</span></div><div><strong>{provider.reputation.completionRate}%</strong><span>completion rate</span></div><div><strong>{provider.reputation.repeatClients}</strong><span>repeat clients</span></div><div><strong>{provider.reputation.unresolvedDisputes}</strong><span>unresolved disputes</span></div></div>
    <div className="profile-layout"><main><div className="trust-badges">{provider.verification.identity==="verified"&&<Badge>Identity verified</Badge>}{provider.verification.work==="verified"&&<Badge tone="neutral">Work reviewed</Badge>}{provider.verification.cac==="verified"&&<Badge tone="neutral">CAC registered</Badge>}</div><section className="profile-section"><h2>About {name.split(" ")[0]}</h2><p>{provider.bio}</p><p><strong>{provider.responseTime}</strong> · {provider.available?"Available for new requests":"Currently unavailable"}</p></section><section className="profile-section"><h2>Services</h2>{services.length?services.map(service=><article className="service-option" key={service.id}><div><strong>{service.name}</strong><p>{service.description}</p></div><b>From {formatNaira(service.startingPrice)}</b></article>):<p>Send a request for a service tailored to your brief.</p>}</section>{portfolio.length>0&&<section className="profile-section"><div className="section-heading"><div><span className="eyebrow">Portfolio</span><h2>Recent work</h2></div></div><div className="work-grid">{portfolio.map(item=><figure key={item.id}><Image unoptimized src={item.image} alt={item.alt} width={640} height={480}/><figcaption>{item.title} · {item.category}</figcaption></figure>)}</div></section>}<section className="profile-section"><h2>Reviews from completed jobs</h2>{reviews.length?reviews.map(review=><article className="review" key={review.id}><b className="stars">{"★".repeat(review.rating)}</b><p>{review.body}</p><small>{review.service} · Verified job</small></article>):<p>Reviews will appear after completed work.</p>}</section></main><aside className="request-panel"><span>Services from</span><strong className="protected-amount">{formatNaira(provider.startingPrice)}</strong><p>{provider.responseTime}</p><Button href={`/requests/${provider.id}`} className="full-width">Request a service</Button>{conversation&&<Button href={`/messages/${conversation.id}`} variant="secondary" className="full-width">Message {name.split(" ")[0]}</Button>}<div className="payment-reassurance">Payment stays protected until you approve the completed work.</div><p className="provider-aside-note">Send a request first. You will review the provider’s quote before paying.</p></aside></div>
  </section>
}
