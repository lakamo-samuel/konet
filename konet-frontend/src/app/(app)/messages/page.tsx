import { getConversationsForUser, getMessagesByConversation } from "@/data/repositories/message.repository";
import { getUserById } from "@/data/repositories/user.repository";
import { getJobById } from "@/data/repositories/job.repository";
import { getSession } from "@/lib/auth/session";
import { InboxList } from "@/features/messaging/components/inbox-list";

export const metadata = { title: "Messages" };
export default async function Page() {
  const session = await getSession();
  const userId = session?.userId ?? "";
  const conversations = await getConversationsForUser(userId);
  const items = await Promise.all(conversations.map(async conversation => {
    const otherId = conversation.participantIds.find(id => id !== userId) ?? "";
    const [other, messages, job] = await Promise.all([
      getUserById(otherId), getMessagesByConversation(conversation.id),
      conversation.jobId ? getJobById(conversation.jobId) : Promise.resolve(null),
    ]);
    return { id: conversation.id, name: other?.name ?? "Konet member", avatar: other?.avatar ?? "", preview: messages.at(-1)?.body ?? "Start the conversation", service: job?.service ?? "Service conversation", updatedAt: conversation.updatedAt };
  }));
  return <section className="content-width app-section messages-page !max-w-6xl">
    <div className="mb-8"><span className="eyebrow">Messages</span><h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">Your conversations</h1><p className="mt-2 text-[var(--muted)]">Keep service details, quotes, and job decisions in one place.</p></div>
    <InboxList items={items} />
  </section>;
}
