import { serverQuery } from "@/data/access/server";
export const getConversationsForUser = (userId: string) => serverQuery("conversations", { userId });
export const getConversationById = (id: string) => serverQuery("conversation", { id });
export const getMessagesByConversation = (conversationId: string) => serverQuery("messages", { conversationId });
