import { OwnedServiceEditor } from "@/features/provider-onboarding/components/owned-services";
export const metadata = { title: "Edit service" };
export default async function Page({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  return (
    <section className="provider-page narrow">
      <div className="page-heading">
        <h1>Edit service</h1>
      </div>
      <OwnedServiceEditor id={serviceId} />
    </section>
  );
}
