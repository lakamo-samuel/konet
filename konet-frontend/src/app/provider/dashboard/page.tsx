import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { RequestList, JobList } from "@/features/hiring/components/work-lists";
export const metadata = { title: "Provider dashboard" };
export default function Page() {
  return (
    <section className="provider-page provider-dashboard">
      <header className="provider-dashboard-heading">
        <div>
          <span className="eyebrow">Provider workspace</span>
          <h1>Your work, in one place</h1>
          <p>Review new requests, follow active jobs, and keep your profile current.</p>
        </div>
        <div className="provider-dashboard-actions">
          <Button href="/provider/services">Manage services</Button>
          <TextLink href="/provider/onboarding/preview" tone="muted">
            View public profile
          </TextLink>
        </div>
      </header>

      <section className="provider-dashboard-section" aria-labelledby="provider-requests-heading">
        <div className="provider-section-heading">
          <div>
            <span className="eyebrow muted">Start here</span>
            <h2 id="provider-requests-heading">Incoming requests</h2>
            <p>Respond to requests that match your services.</p>
          </div>
          <TextLink href="/provider/requests">All requests</TextLink>
        </div>
        <RequestList provider />
      </section>

      <section className="provider-dashboard-section" aria-labelledby="provider-jobs-heading">
        <div className="provider-section-heading">
          <div>
            <span className="eyebrow muted">In progress</span>
            <h2 id="provider-jobs-heading">Your jobs</h2>
            <p>Keep track of work you have agreed to deliver.</p>
          </div>
          <TextLink href="/jobs">All jobs</TextLink>
        </div>
        <JobList />
      </section>
    </section>
  );
}
