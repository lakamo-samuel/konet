import { notFound } from "next/navigation";
import { getCurrentUser } from "@/data/repositories/user.repository";
import { getProviderById } from "@/data/repositories/provider.repository";
import { ProviderSettingsForm } from "@/features/settings/components/provider-settings-form";
export const metadata = { title: "Provider settings" };
export default async function Page() {
  const user = await getCurrentUser();
  const provider = user.providerProfileId ? await getProviderById(user.providerProfileId) : null;
  if (!provider) notFound();
  return <section className="provider-page narrow"><div className="page-heading"><span className="eyebrow">Provider profile</span><h1>Settings</h1></div><ProviderSettingsForm provider={provider} /></section>;
}
