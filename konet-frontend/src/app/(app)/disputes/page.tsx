import { DisputeList } from "@/features/disputes/components/dispute-workspace";
import { PageHeader } from "@/components/ui/page-header";
export const metadata = { title: "Disputes" };
export default function Page() {
  return (
    <section className="workspace-page">
      <PageHeader
        eyebrow="Resolution center"
        title="Your disputes"
        description="Follow the review and outcome of cases related to your jobs."
      />
      <DisputeList />
    </section>
  );
}
