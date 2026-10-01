import { Select } from "@/components/ui/select";
import { OnboardingForm } from "@/features/provider-onboarding/components/onboarding-form";
import { OnboardingFrame } from "@/features/provider-onboarding/components/onboarding-frame";
export const metadata = { title: "Provider profile" };
export default function Page() { return <OnboardingFrame step={1} title="Introduce your work" description="Tell clients who you are, what you do, and what makes your work distinctive.">
  <OnboardingForm step="profile" next="/provider/onboarding/service">
    <label className="field">Professional title<input name="title" required placeholder="e.g. Portrait photographer" /></label>
    <label className="field">Category<Select label="Category" name="category" options={["Photography", "Design", "Tutoring", "Beauty", "Technology"].map(label => ({ value: label, label }))} /></label>
    <label className="field">Professional bio<textarea name="bio" required minLength={80} rows={6} placeholder="Explain your experience, approach, and what clients can expect." /></label>
  </OnboardingForm>
</OnboardingFrame>; }
