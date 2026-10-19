import { InboxList } from "@/features/messaging/components/inbox-list";
import { PageHeader } from "@/components/ui/page-header";
export const metadata = { title: "Messages" };
export default function Page() {
  return (
    <section className="content-width app-section messages-page">
      <PageHeader
        eyebrow="Messages"
        title="Your conversations"
        description="Keep job details, updates and decisions in one place."
      />
      <InboxList />
    </section>
  );
}
