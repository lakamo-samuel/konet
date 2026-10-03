import { PortfolioStep } from "@/features/provider-onboarding/components/portfolio-step";
export const metadata = { title: "Provider portfolio" };
export default function Page() {
  return (
    <section className="provider-page">
      <div className="page-heading">
        <h1>Your portfolio</h1>
        <p>Keep your strongest work examples up to date.</p>
      </div>
      <PortfolioStep />
    </section>
  );
}
