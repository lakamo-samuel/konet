import { notFound } from "next/navigation";
import { AdminDetail } from "@/features/admin/components/admin-resource";
import { resources } from "@/features/admin/resources";
export default async function AdminRecordPage({params}:{params:Promise<{section:string;id:string}>}) {
 const {section,id}=await params;
 if(!Object.hasOwn(resources,section)||!resources[section].detail||!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id))notFound();
 return <AdminDetail section={section} id={id}/>;
}
