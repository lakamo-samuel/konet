import { ProfileStep } from "@/features/provider-onboarding/components/profile-step";
import { OnboardingFrame } from "@/features/provider-onboarding/components/onboarding-frame";
export const metadata = { title: "Introduce your work" };
export default function Page() {
  return (
    <OnboardingFrame
      step={1}
      title="Introduce your work"
      description="Tell clients about your experience and skills."
    >
      <ProfileStep />
    </OnboardingFrame>
  );
}
