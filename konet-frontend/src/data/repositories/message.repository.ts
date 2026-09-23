import {conversations,messages} from "@/data/mock/jobs";
export async function getConversationsForUser(userId:string){return conversations.filter(item=>item.participantIds.includes(userId));}
export async function getConversationById(id:string){return conversations.find(item=>item.id===id)??null;}
export async function getMessagesByConversation(id:string){return messages.filter(item=>item.conversationId===id);}
