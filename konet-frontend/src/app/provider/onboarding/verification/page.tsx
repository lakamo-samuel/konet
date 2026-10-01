import { OnboardingForm } from "@/features/provider-onboarding/components/onboarding-form";
import { OnboardingFrame } from "@/features/provider-onboarding/components/onboarding-frame";
export const metadata = { title: "Provider verification" };
export default function Page() { return <OnboardingFrame step={4} title="Verify your identity and work" description="Verification helps clients understand which details have been checked.">
  <OnboardingForm step="verification" next="/provider/onboarding/preview">
    <label className="field">Government issued ID<input name="identityDocument" type="file" accept="image/*,.pdf" required /></label>
    <label className="field">Work evidence<input name="workEvidence" type="file" accept="image/*,.pdf" required /></label>
    <p className="text-sm text-[var(--muted)]">Accepted formats: image or PDF. Your documents are used only for verification.</p>
  </OnboardingForm>
</OnboardingFrame>; }
