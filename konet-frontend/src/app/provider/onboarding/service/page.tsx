import { ServiceStep } from "@/features/provider-onboarding/components/service-step";
import { OnboardingFrame } from "@/features/provider-onboarding/components/onboarding-frame";
export const metadata = { title: "Define your services" };
export default function Page() {
  return (
    <OnboardingFrame
      step={2}
      title="Define your services"
      description="Save a draft service with an active category and clear pricing."
    >
      <ServiceStep />
    </OnboardingFrame>
  );
}
