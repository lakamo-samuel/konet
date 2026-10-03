import { PreviewStep } from "@/features/provider-onboarding/components/preview-step";
import { OnboardingFrame } from "@/features/provider-onboarding/components/onboarding-frame";
export const metadata = { title: "Review your application" };
export default function Page() {
  return (
    <OnboardingFrame
      step={5}
      title="Review your application"
      description="Submit for admin approval before publishing."
    >
      <PreviewStep />
    </OnboardingFrame>
  );
}
