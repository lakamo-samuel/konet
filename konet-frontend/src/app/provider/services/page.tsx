import { OwnedServices } from "@/features/provider-onboarding/components/owned-services";
export const metadata = { title: "Provider services" };
export default function Page() {
  return (
    <section className="provider-page">
      <div className="page-heading">
        <h1>Your services</h1>
        <p>
          Draft services remain private until you publish and activate them.
        </p>
      </div>
      <OwnedServices />
    </section>
  );
}
