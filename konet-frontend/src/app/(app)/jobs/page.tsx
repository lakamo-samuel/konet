import { JobList } from "@/features/hiring/components/work-lists";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
export const metadata = { title: "Jobs" };
export default function Page() {
  return (
    <section className="workspace-page">
      <PageHeader
        eyebrow="Your activity"
        title="My jobs"
        description="Track work, payments and decisions for services you hire or provide."
        action={<Button href="/disputes" variant="secondary">Your disputes</Button>}
      />
      <JobList />
    </section>
  );
}
