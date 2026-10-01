import { notFound } from "next/navigation";
import { getServicesByProvider } from "@/data/repositories/provider.repository";
import { getCurrentUser } from "@/data/repositories/user.repository";
import { ServiceEditor } from "@/features/services/components/service-editor";
type Props = { params: Promise<{ serviceId: string }> };
export const metadata = { title: "Edit service" };
export default async function Page({ params }: Props) {
  const { serviceId } = await params;
  const user = await getCurrentUser();
  const providerId = user.providerProfileId;
  if (!providerId) notFound();
  const service = (await getServicesByProvider(providerId)).find(item => item.id === serviceId);
  if (!service) notFound();
  return <section className="provider-page narrow"><div className="page-heading"><span className="eyebrow">Your offer</span><h1>Edit service</h1></div><ServiceEditor providerId={providerId} service={service} /></section>;
}
