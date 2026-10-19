import { PortfolioStep } from "@/features/provider-onboarding/components/portfolio-step";
import { PageHeader } from "@/components/ui/page-header";
export const metadata = { title: "Provider portfolio" };
export default function Page() {
  return (
    <section className="provider-page">
      <PageHeader
        eyebrow="Provider workspace"
        title="Your portfolio"
        description="Keep your strongest work examples and project images up to date."
      />
      <PortfolioStep />
    </section>
  );
}
