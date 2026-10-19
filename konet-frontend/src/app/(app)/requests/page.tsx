import { RequestList } from "@/features/hiring/components/work-lists";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
export const metadata = { title: "My requests" };
export default function Page() {
  return (
    <section className="workspace-page">
      <PageHeader
        eyebrow="Find the right help"
        title="My service requests"
        description="Keep track of the services you have requested and the providers responding."
        action={<Button href="/requests/new">Create request</Button>}
      />
      <RequestList />
    </section>
  );
}
