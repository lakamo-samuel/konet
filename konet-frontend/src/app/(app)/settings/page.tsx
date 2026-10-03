import { AccountSettingsForm } from "@/features/settings/components/account-settings-form";
export const metadata = { title: "Settings" };
export default function Page() {
  return (
    <section className="workspace-page narrow">
      <div className="page-heading">
        <span className="eyebrow">Account</span>
        <h1>Settings</h1>
        <p>Manage profile, affiliation and account security.</p>
      </div>
      <AccountSettingsForm />
    </section>
  );
}
