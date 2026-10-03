import { MessageThread } from "@/features/messaging/components/message-thread";
export const metadata = { title: "Conversation" };
export default async function Page({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  return (
    <section className="content-width app-section messages-page">
      <MessageThread key={conversationId} conversationId={conversationId} />
    </section>
  );
}
