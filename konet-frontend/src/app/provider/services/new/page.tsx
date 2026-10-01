import { getCurrentUser } from "@/data/repositories/user.repository";
import { ServiceEditor } from "@/features/services/components/service-editor";
export const metadata = { title: "New service" };
export default async function Page() { const user = await getCurrentUser(); return <section className="provider-page narrow"><div className="page-heading"><span className="eyebrow">Your offer</span><h1>Add a service</h1><p>Give clients enough detail to decide if your service fits their project.</p></div>{user.providerProfileId && <ServiceEditor providerId={user.providerProfileId} />}</section>; }
