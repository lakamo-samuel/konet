import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getConversationById, getConversationsForUser, getMessagesByConversation } from "@/data/repositories/message.repository";
import { getJobById } from "@/data/repositories/job.repository";
import { getUserById } from "@/data/repositories/user.repository";
import { getSession } from "@/lib/auth/session";
import { MessageThread } from "@/features/messaging/components/message-thread";

type Props = { params: Promise<{ conversationId: string }> };
export const metadata = { title: "Conversation" };
export default async function Page({ params }: Props) {
  const { conversationId } = await params;
  const session = await getSession();
  const userId = session?.userId ?? "";
  const [conversation, conversations] = await Promise.all([getConversationById(conversationId), getConversationsForUser(userId)]);
  if (!conversation || !conversation.participantIds.includes(userId)) notFound();
  const otherId = conversation.participantIds.find(id => id !== userId) ?? "";
  const [other, messages, job] = await Promise.all([getUserById(otherId), getMessagesByConversation(conversationId), conversation.jobId ? getJobById(conversation.jobId) : Promise.resolve(null)]);
  const otherName = other?.name ?? "Konet member";
  const sidebar = await Promise.all(conversations.map(async item => {
    const participant = await getUserById(item.participantIds.find(id => id !== userId) ?? "");
    return { id: item.id, name: participant?.name ?? "Konet member", avatar: participant?.avatar ?? "" };
  }));
  return <section className="content-width app-section messages-page !max-w-7xl">
    <div className="mb-5"><Link href="/messages" className="text-sm font-semibold text-[var(--clay)] hover:underline">← Back to inbox</Link></div>
    <div className="grid min-h-[620px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] lg:h-[min(760px,calc(100vh-170px))] lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="hidden border-r border-[var(--border)] lg:block"><div className="border-b border-[var(--border)] p-5"><h2 className="text-lg font-bold">Messages</h2><p className="text-sm text-[var(--muted)]">{conversations.length} conversation{conversations.length === 1 ? "" : "s"}</p></div>
        {sidebar.map(item => <Link href={`/messages/${item.id}`} key={item.id} aria-current={item.id === conversationId ? "page" : undefined} className={`flex items-center gap-3 border-b border-[var(--border)] p-4 text-[var(--ink)] hover:bg-[var(--canvas)] ${item.id === conversationId ? "bg-[var(--canvas)]" : ""}`}><Avatar src={item.avatar} name={item.name} size={42} /><strong className="truncate text-sm">{item.name}</strong></Link>)}
      </aside>
      <main className="flex min-h-0 flex-col"><header className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] p-4 sm:p-5"><Avatar src={other?.avatar ?? ""} name={otherName} size={44} /><div className="min-w-0 flex-1"><h1 className="truncate font-bold">{otherName}</h1><p className="text-xs text-[var(--muted)]">Service conversation</p></div>{other?.studentVerification === "verified" && <Badge>Student verified</Badge>}</header>
        {job && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--canvas)] px-4 py-3 sm:px-5"><div><span className="text-xs font-bold uppercase tracking-wide text-[var(--clay)]">Active job</span><strong className="block text-sm">{job.service}</strong></div><Button href={`/jobs/${job.id}`} variant="secondary">View job</Button></div>}
        <MessageThread conversationId={conversationId} userId={userId} initialMessages={messages} />
      </main>
    </div>
  </section>;
}
