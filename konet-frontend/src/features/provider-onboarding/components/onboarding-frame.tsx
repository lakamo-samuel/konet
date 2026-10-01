import Link from "next/link";
import type { ReactNode } from "react";

const steps = [
  { label: "Your profile", href: "/provider/onboarding/profile" },
  { label: "First service", href: "/provider/onboarding/service" },
  { label: "Portfolio", href: "/provider/onboarding/portfolio" },
  { label: "Verification", href: "/provider/onboarding/verification" },
  { label: "Review", href: "/provider/onboarding/preview" },
];
export function OnboardingFrame({ step, title, description, children }: { step: number; title: string; description: string; children: ReactNode }) {
  return <section className="content-width app-section !max-w-7xl">
    <div className="mb-8 border-b border-[var(--border)] pb-7"><span className="eyebrow">Offer a service · Step {step} of {steps.length}</span><h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">{title}</h1><p className="mt-3 max-w-2xl text-[var(--muted)]">{description}</p></div>
    <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-12">
      <nav aria-label="Provider setup steps" className="self-start rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:sticky lg:top-24">
        {steps.map((item, index) => <Link href={item.href} key={item.href} aria-current={step === index + 1 ? "step" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${step === index + 1 ? "bg-[var(--canvas)] text-[var(--ink)]" : "text-[var(--muted)] hover:bg-[var(--canvas)] hover:text-[var(--ink)]"}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs ${step > index + 1 ? "bg-[var(--green)] text-white" : step === index + 1 ? "bg-[var(--clay)] text-white" : "bg-[var(--canvas)] text-[var(--muted)]"}`}>{step > index + 1 ? "✓" : index + 1}</span>{item.label}</Link>)}
      </nav>
      <div className="min-w-0 max-w-3xl">{children}</div>
    </div>
  </section>;
}
