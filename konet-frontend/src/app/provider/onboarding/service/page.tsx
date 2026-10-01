import { Select } from "@/components/ui/select";
import { OnboardingForm } from "@/features/provider-onboarding/components/onboarding-form";
import { OnboardingFrame } from "@/features/provider-onboarding/components/onboarding-frame";
export const metadata = { title: "Add a service" };
export default function Page() { return <OnboardingFrame step={2} title="Define your first service" description="A clear scope and starting price help clients send better requests.">
  <OnboardingForm step="service" next="/provider/onboarding/portfolio">
    <label className="field">Service name<input name="name" required placeholder="e.g. Campus portrait session" /></label>
    <label className="field">What is included?<textarea name="description" required rows={5} placeholder="Describe the deliverables and how the service works." /></label>
    <div className="grid gap-4 sm:grid-cols-2"><label className="field">Starting price (₦)<input name="price" type="number" min={500} required /></label><label className="field">Pricing unit<Select label="Pricing unit" name="pricing" options={["per session", "per hour", "per project"].map(label => ({ value: label, label }))} /></label></div>
  </OnboardingForm>
</OnboardingFrame>; }
