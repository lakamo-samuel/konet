import Link from "next/link";
import { serverQuery } from "@/data/access/server";
import { isStaff } from "@/features/admin/operations";
import { AdminShell } from "@/features/admin/components/admin-shell";
import "./admin.css";
export const metadata = {
  title: "Staff dashboard",
  robots: { index: false, follow: false },
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await serverQuery("currentUser", {});
  if (!isStaff(user.roles ?? []))
    return (
      <main className="admin-denied">
        <h1>Staff access required</h1>
        <p>Your account does not have a staff role.</p>
        <Link href="/discover">Return to Konet</Link>
      </main>
    );
  return <AdminShell initialUser={user}>{children}</AdminShell>;
}
