import { notFound } from "next/navigation";
import {
  getProviderById,
  getServicesByProvider,
} from "@/data/repositories/provider.repository";
import { RequestForm } from "@/features/requests/components/request-form";
export const metadata = { title: "Request a service" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ providerId?: string }>;
}) {
  const { providerId } = await searchParams;
  if (!providerId) notFound();
  const provider = await getProviderById(providerId);
  if (!provider) notFound();
  const services = await getServicesByProvider(providerId);
  return (
    <section className="workspace-page narrow">
      <h1>Request a service from {provider.fullName ?? provider.professionalTitle}</h1>
      <RequestForm providerId={providerId} services={services} />
    </section>
  );
}
