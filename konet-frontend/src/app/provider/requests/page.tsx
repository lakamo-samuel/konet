import { RequestList } from "@/features/hiring/components/work-lists";
import { PageHeader } from "@/components/ui/page-header";
export const metadata = { title: "Provider requests" };
export default function Page() {
  return (
    <section className="provider-page">
      <PageHeader
        eyebrow="Provider workspace"
        title="Incoming requests"
        description="Review new opportunities and keep every client request moving."
      />
      <RequestList provider />
    </section>
  );
}
