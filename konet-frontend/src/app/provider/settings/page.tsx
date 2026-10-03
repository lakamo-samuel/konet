import { ProviderSettingsForm } from "@/features/settings/components/provider-settings-form";
export const metadata = { title: "Provider settings" };
export default function Page() {
  return (
    <section className="provider-page narrow">
      <div className="page-heading">
        <span className="eyebrow">Provider profile</span>
        <h1>Settings</h1>
      </div>
      <ProviderSettingsForm />
    </section>
  );
}
