import { notFound } from "next/navigation";
import { AdminResource } from "@/features/admin/components/admin-resource";
import { AdminReports } from "@/features/admin/components/admin-overview";
import { resources } from "@/features/admin/resources";
export default async function AdminSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (section === "security") return null;
  if (section === "reports") return <AdminReports />;
  if (!Object.hasOwn(resources, section)) notFound();
  return <AdminResource section={section} />;
}
