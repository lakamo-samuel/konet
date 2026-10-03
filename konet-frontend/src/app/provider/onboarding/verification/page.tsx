import { EvidenceStep } from "@/features/provider-onboarding/components/evidence-step";
import { OnboardingFrame } from "@/features/provider-onboarding/components/onboarding-frame";
export const metadata = { title: "Verify identity and work" };
export default function Page() {
  return (
    <OnboardingFrame
      step={4}
      title="Verify identity and work"
      description="Identity and work are required; CAC is optional."
    >
      <EvidenceStep />
    </OnboardingFrame>
  );
}
