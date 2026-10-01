import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PublishProviderButton } from "@/features/provider-onboarding/components/publish-provider-button";
import { OnboardingFrame } from "@/features/provider-onboarding/components/onboarding-frame";
import { serverQuery } from "@/data/access/server";
import { formatNaira } from "@/lib/formatters/currency";
export const metadata = { title: "Review provider profile" };
export default async function Page() {
  const draft = await serverQuery("onboarding", {});
  return <OnboardingFrame step={5} title="Review your profile" description="Check how your service will appear to students before publishing.">
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-8">
      <Badge>Profile review</Badge><h2 className="mt-5 text-2xl font-bold">{draft.profile?.title || "Your professional title"}</h2><p className="mt-2 text-sm text-[var(--muted)]">{draft.profile?.category || "Category"}</p><p className="mt-5 leading-7">{draft.profile?.bio || "Your professional bio will appear here."}</p>
      <div className="mt-7 border-t border-[var(--border)] pt-6"><span className="eyebrow">First service</span><h3 className="mt-2 text-lg font-bold">{draft.service?.name || "Service name"}</h3><p className="mt-2 text-sm text-[var(--muted)]">{draft.service?.description || "Service description"}</p>{draft.service?.price && <p className="mt-3 font-bold">From {formatNaira(Number(draft.service.price))} {draft.service.pricing}</p>}</div>
      <div className="mt-7 border-t border-[var(--border)] pt-6"><span className="eyebrow">Portfolio and verification</span><p className="mt-2 text-sm text-[var(--muted)]">{draft.portfolio?.title || "Portfolio project pending"} · {draft.verification?.identityDocument ? "Documents submitted" : "Documents still needed"}</p></div>
    </div>
    <div className="mt-6 flex flex-wrap gap-3"><PublishProviderButton /><Button href="/provider/onboarding/profile" variant="secondary">Edit profile</Button></div>
  </OnboardingFrame>;
}
