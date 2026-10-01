"use client";
import { useState } from "react";
import { Send } from "lucide-react";
import { useDataCommand, useDataQuery } from "@/lib/query/hooks";
import type { Message } from "@/types/domain";

export function MessageThread({ conversationId, userId, initialMessages }: { conversationId: string; userId: string; initialMessages: Message[] }) {
  const { data: messages = initialMessages } = useDataQuery("messages", { conversationId }, initialMessages);
  const send = useDataCommand("sendMessage");
  const [text, setText] = useState("");
  return <div className="flex min-h-0 flex-1 flex-col bg-[#fbfaf6]">
    <div className="flex min-h-[380px] flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6" aria-live="polite">
      {messages.map(message => message.system ? <div key={message.id} className="self-center rounded-full bg-[#efebe3] px-4 py-2 text-center text-xs text-[var(--muted)]">{message.body}</div> :
        <div key={message.id} className={`flex max-w-[80%] flex-col gap-1 ${message.senderId === userId ? "self-end items-end" : "self-start items-start"}`}>
          <p className={`rounded-2xl px-4 py-3 text-sm leading-6 ${message.senderId === userId ? "bg-[var(--clay)] text-white" : "bg-[#eeeae1] text-[var(--ink)]"}`}>{message.body}</p>
          <time className="px-1 text-xs text-[var(--muted)]" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}</time>
        </div>)}
    </div>
    <form className="flex gap-3 border-t border-[var(--border)] bg-[var(--surface)] p-4" onSubmit={async event => { event.preventDefault(); const body = text.trim(); if (!body || send.isPending) return; try { await send.mutateAsync({ conversationId, body }); setText(""); } catch { /* Error is shown below. */ } }}>
      <label htmlFor="message-text" className="sr-only">Message</label><input id="message-text" value={text} onChange={event => setText(event.target.value)} placeholder="Write a message" maxLength={2000} className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-4 text-sm outline-none focus:border-[var(--clay)]" />
      <button type="submit" disabled={!text.trim() || send.isPending} aria-label="Send message" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--clay)] text-white transition-opacity disabled:opacity-50"><Send size={18} aria-hidden /></button>
    </form>
    {send.isError && <p role="alert" className="bg-[var(--surface)] px-4 pb-3 text-sm text-red-700">Message could not be sent. Please try again.</p>}
  </div>;
}
