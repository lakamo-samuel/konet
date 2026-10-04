import Image from "next/image";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import Icon from "@/components/ui/icon";
import {Avatar} from "@/components/ui/avatar";
import {Button} from "@/components/ui/button";
import {SearchForm} from "@/features/discovery/components/search-form";
import {ProviderCard} from "@/features/providers/components/provider-card";
import {getProviders} from "@/data/repositories/provider.repository";
import {getUniversities} from "@/data/repositories/university.repository";
import {optionalPublicData} from "@/data/access/availability";
import {RetryPageButton} from "@/components/ui/retry-page-button";

export default async function Home(){
  const [providerResult,universityResult]=await Promise.all([optionalPublicData(getProviders,[]),optionalPublicData(getUniversities,[])]);
  const allProviders=providerResult.data;
  const universities=universityResult.data;
  const talentUnavailable=providerResult.unavailable || universityResult.unavailable;
  const providers=allProviders.filter(provider=>universities.some(university=>university.id===provider.universityId));
  const featured=providers.slice(0,4);
  const moreProviders=providers.slice(4,7);
  const providerCard=(provider:(typeof providers)[number])=>{
    const university=universities.find(item=>item.id===provider.universityId);
    return university?<ProviderCard key={provider.id} provider={provider} university={university}/>:null;
  };
  return <>
    <section className="content-width hero">
      <div className="hero-copy">
        <span className="eyebrow"><span/>Big talent. Right here on campus.</span>
        <h1>Your campus has<br/><em>who you need.</em></h1>
        <p className="hero-description">Find and hire talented students you can trust.<br/>From a fresh fade to your next big idea.</p>
        <SearchForm universities={universities} variant="hero"/>
        {universityResult.unavailable && <p className="hero-directory-notice" role="status">University filters are temporarily unavailable. Please try again shortly.</p>}
        <div className="try-search">Try <Link href="/discover?q=Photographer+for+Saturday+under+%E2%82%A620k">“Photographer for Saturday under ₦20k” <Icon name="arrow" size={14}/></Link></div>
        <div className="hero-social"><div className="avatar-stack">{featured.map(provider=><Avatar key={provider.id} src={provider.avatar} name={provider.professionalTitle} size={32}/>)}</div><p>A campus full of talent.<br/><strong>A community built on trust.</strong></p></div>
      </div>
      <div className="hero-art">
        <div className="art-note">Real students. Remarkable talent. <span>↘</span></div>
        <Link className="hero-portrait hero-portrait-main" href="/discover?q=Photography">
          <Image unoptimized priority src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=85" alt="Outdoor portrait showcasing photography" fill sizes="(max-width: 900px) 75vw, 395px"/>
          <div className="portrait-caption"><span>Behind the work</span><strong>Capture your moment.</strong><small>Portrait &amp; event photography</small></div><span className="portrait-arrow"><Icon name="arrow" size={20}/></span>
        </Link>
        <Link className="hero-portrait hero-portrait-small" href="/discover?q=Barbering"><Image unoptimized src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=85" alt="Barber at work in a barbershop" fill sizes="225px"/><div className="small-portrait-caption"><strong>Campus talent.</strong><span>Barbering &amp; grooming</span></div></Link>
        <div className="trust-float"><span className="trust-float-icon"><Icon name="verified" size={23}/></span><div><strong>Talent you can trust.</strong><span>Verified students. Proven work.</span></div></div>
        <div className="art-bottom-note"><span className="little-line"/>Made across Nigerian campuses.</div>
      </div>
    </section>
    <section className="trust-strip"><div className="content-width"><span><Icon name="verified"/>Verified students only</span><span><Icon name="eye"/>Real work. Real reviews.</span><span><Icon name="shield"/>Protected payments</span><span><Icon name="pin"/>Your campus community</span></div></section>
    <section className="content-width discovery-section"><div className="section-heading"><div><span className="eyebrow"><span/>Your campus. Your people.</span><h2>Talent, ready when you are.</h2><p>Meet students building a reputation through real work.</p></div><Button href="/discover" variant="secondary">Explore all talent</Button></div>{featured.length ? <div className="provider-grid">{featured.map(providerCard)}</div> : talentUnavailable ? <EmptyState icon="briefcase" title="Talent is temporarily unavailable" description="We couldn’t load the marketplace right now. Please try again shortly." action={<RetryPageButton/>} /> : <EmptyState icon="briefcase" title="Your campus marketplace is growing" description="Student providers will appear here once their profiles are approved. Have a skill to share? Be one of the first." action={<Button href="/provider/onboarding">Offer your service</Button>} />}</section>
    <section className="content-width how-section"><div className="section-heading"><div><span className="eyebrow"><span/>Simple. Safe. Student-first.</span><h2>From “I need help” to <em>done well.</em></h2></div></div><div className="steps-grid">{[["01","search","Find your person","Search by skill, campus, availability, or budget."],["02","message","Make it a plan","Share what you need and agree on the details and a clear quote."],["03","shield","Pay with peace of mind","Your payment stays protected while your provider gets to work."],["04","check","Done, and done well","Approve the work, release payment, and leave an honest review."]].map(([n,icon,title,text])=><article className="how-step" key={n}><div className="step-top"><Icon name={icon} size={23}/><span>{n}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    {moreProviders.length > 0 && <section className="content-width rising-section"><div className="section-heading"><div><span className="eyebrow muted">Ones to watch</span><h2>Small beginnings. <em>Serious talent.</em></h2><p>Meet students making a name for themselves.</p></div></div><div className="provider-grid rising-grid">{moreProviders.map(providerCard)}</div></section>}
    <section className="content-width provider-banner"><div><span className="eyebrow">Your skills deserve to be seen</span><h2>Good at something?<br/><em>Your campus should know.</em></h2><p>Turn what you love doing into your next opportunity.<br/>Build your profile. Show your work. Find your people.</p><Button href="/provider/onboarding" variant="dark">Offer your service <Icon name="arrow" size={18}/></Button><span className="banner-footnote">Free to join. Built for students like you.</span></div><div className="banner-graphic" aria-hidden="true"><div className="graphic-orbit"/><span className="graphic-word">Your next<br/><em>big thing</em><br/>starts here.</span><span className="graphic-spark">✳</span></div></section>
  </>
}
