import { OnboardingForm } from "@/features/provider-onboarding/components/onboarding-form";
import { OnboardingFrame } from "@/features/provider-onboarding/components/onboarding-frame";
export const metadata = { title: "Portfolio" };
export default function Page() { return <OnboardingFrame step={3} title="Show evidence of your work" description="Choose a strong example and explain the part you played in it.">
  <OnboardingForm step="portfolio" next="/provider/onboarding/verification">
    <label className="field">Portfolio image<input name="image" type="file" accept="image/*" /></label>
    <label className="field">Project title<input name="title" required /></label>
    <label className="field">Describe your contribution<textarea name="description" rows={4} required /></label>
  </OnboardingForm>
</OnboardingFrame>; }
