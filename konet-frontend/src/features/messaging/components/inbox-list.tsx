"use client";
import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

type InboxItem = { id: string; name: string; avatar: string; preview: string; service: string; updatedAt: string };
export function InboxList({ items }: { items: InboxItem[] }) {
  const [search, setSearch] = useState("");
  const visible = items.filter(item => `${item.name} ${item.preview} ${item.service}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
    <div className="flex flex-col gap-4 border-b border-[var(--border)] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-lg font-bold">Inbox</h2><p className="text-sm text-[var(--muted)]">{items.length} conversation{items.length === 1 ? "" : "s"}</p></div>
      <label className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-3 focus-within:outline-2 focus-within:outline-[var(--clay)] sm:w-72"><Search size={17} aria-hidden className="text-[var(--muted)]" /><span className="sr-only">Search conversations</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search conversations" className="w-full min-w-0 border-0 bg-transparent text-sm outline-none" /></label>
    </div>
    {visible.length ? visible.map(item => <Link href={`/messages/${item.id}`} key={item.id} className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 border-b border-[var(--border)] p-5 text-[var(--ink)] transition-colors last:border-b-0 hover:bg-[var(--canvas)] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--clay)] sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:items-center">
      <Avatar src={item.avatar} name={item.name} size={48} />
      <span className="min-w-0"><strong className="block truncate text-base">{item.name}</strong><span className="mt-1 block truncate text-sm text-[var(--muted)]">{item.preview}</span><span className="mt-2 block text-xs font-semibold text-[var(--clay)]">{item.service}</span></span>
      <time className="col-start-2 text-xs text-[var(--muted)] sm:col-start-3 sm:row-start-1" dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</time>
    </Link>) : <p className="p-8 text-center text-sm text-[var(--muted)]">No conversations match your search.</p>}
  </div>;
}
