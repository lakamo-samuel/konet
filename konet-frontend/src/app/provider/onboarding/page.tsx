import { Button } from "@/components/ui/button";
import { CheckCircle2, ShieldCheck, BriefcaseBusiness } from "lucide-react";
export const metadata = { title: "Become a provider" };
export default function Page() {
  return <section className="content-width app-section !max-w-7xl">
    <div className="grid items-center gap-12 py-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)] lg:gap-20 lg:py-14">
      <div><span className="eyebrow">Offer a service on Konet</span><h1 className="mt-5 max-w-3xl text-5xl font-bold leading-tight tracking-tight md:text-6xl">Turn your skills into work people can trust.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">Create a professional profile, describe your first service, show examples of your work, and complete verification before publishing.</p><div className="mt-8 flex flex-wrap items-center gap-4"><Button href="/provider/onboarding/profile">Start your profile</Button><span className="text-sm text-[var(--muted)]">Five clear steps. Save as you go.</span></div></div>
      <aside className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8"><span className="eyebrow">What you’ll set up</span><div className="mt-6 grid gap-5"><div className="flex gap-4"><BriefcaseBusiness aria-hidden className="shrink-0 text-[var(--clay)]" /><div><strong>Service and pricing</strong><p className="mt-1 text-sm text-[var(--muted)]">Help clients understand exactly what you offer.</p></div></div><div className="flex gap-4"><CheckCircle2 aria-hidden className="shrink-0 text-[var(--clay)]" /><div><strong>Portfolio</strong><p className="mt-1 text-sm text-[var(--muted)]">Show evidence of your skills and previous work.</p></div></div><div className="flex gap-4"><ShieldCheck aria-hidden className="shrink-0 text-[var(--clay)]" /><div><strong>Verification</strong><p className="mt-1 text-sm text-[var(--muted)]">Give students confidence in who they hire.</p></div></div></div></aside>
    </div>
  </section>;
}
