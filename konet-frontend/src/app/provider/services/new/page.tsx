import { OwnedServiceEditor } from "@/features/provider-onboarding/components/owned-services";
export const metadata = { title: "New service" };
export default function Page() {
  return (
    <section className="provider-page narrow">
      <div className="page-heading">
        <h1>Add a service</h1>
      </div>
      <OwnedServiceEditor />
    </section>
  );
}
