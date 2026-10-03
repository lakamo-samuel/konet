import { InboxList } from "@/features/messaging/components/inbox-list";
export const metadata = { title: "Messages" };
export default function Page() {
  return (
    <section className="content-width app-section messages-page">
      <div className="page-heading">
        <span className="eyebrow">Messages</span>
        <h1>Your conversations</h1>
        <p>Keep job details and decisions in one place.</p>
      </div>
      <InboxList />
    </section>
  );
}
