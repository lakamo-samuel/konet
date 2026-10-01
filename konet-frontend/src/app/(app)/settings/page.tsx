import { getCurrentUser } from "@/data/repositories/user.repository";
import { getUniversityById } from "@/data/repositories/university.repository";
import { AccountSettingsForm } from "@/features/settings/components/account-settings-form";
export const metadata = { title: "Settings" };
export default async function Page() {
  const user = await getCurrentUser();
  const university = await getUniversityById(user.universityId);
  return <section className="workspace-page narrow"><div className="page-heading"><span className="eyebrow">Account</span><h1>Settings</h1><p>Manage your profile details and campus.</p></div><AccountSettingsForm user={user} campuses={university?.campuses ?? [user.campus]} /></section>;
}
