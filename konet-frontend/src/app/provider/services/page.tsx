import { OwnedServices } from "@/features/provider-onboarding/components/owned-services";
import { PageHeader } from "@/components/ui/page-header";
export const metadata = { title: "Provider services" };
export default function Page() {
  return (
    <section className="provider-page">
      <PageHeader
        eyebrow="Provider workspace"
        title="Your services"
        description="Manage your offers. Draft services stay private until you publish and activate them."
      />
      <OwnedServices />
    </section>
  );
}
