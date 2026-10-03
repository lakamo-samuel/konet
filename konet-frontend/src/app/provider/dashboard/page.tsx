import { Button } from "@/components/ui/button";
import { RequestList, JobList } from "@/features/hiring/components/work-lists";
export const metadata = { title: "Provider dashboard" };
export default function Page() {
  return (
    <section className="provider-page form-stack">
      <h1>Provider workspace</h1>
      <Button href="/provider/onboarding/preview" variant="secondary">
        View profile and review status
      </Button>
      <h2>Incoming requests</h2>
      <RequestList provider />
      <h2>Your jobs</h2>
      <JobList />
    </section>
  );
}
