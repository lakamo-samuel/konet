import { PortfolioStep } from "@/features/provider-onboarding/components/portfolio-step";
import { OnboardingFrame } from "@/features/provider-onboarding/components/onboarding-frame";
export const metadata = { title: "Show your work" };
export default function Page() {
  return (
    <OnboardingFrame
      step={3}
      title="Show your work"
      description="Add optional project descriptions and public HTTPS links."
    >
      <PortfolioStep />
    </OnboardingFrame>
  );
}
