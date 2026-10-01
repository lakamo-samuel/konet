"use client";

import Link from "next/link";
import { useDataQuery, useDataCommand } from "@/lib/query/hooks";
import type { Notification } from "@/types/domain";
import Icon from "@/components/ui/icon";

const iconByType: Record<Notification["type"], string> = {
  request: "mail", quote: "briefcase", payment: "shield", job: "check",
  review: "star", verification: "verified", dispute: "bell",
};

export function NotificationFeed({ userId, initialItems }: { userId: string; initialItems: Notification[] }) {
  const { data: items = [], isError, refetch } = useDataQuery("notifications", { userId }, initialItems);
  const markRead = useDataCommand("readNotification");
  const unreadCount = items.filter(item => !item.read).length;
  return <section className="content-width app-section notifications-page">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-6">
      <div><span className="eyebrow">Your activity</span><h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">Notifications</h1><p className="mt-2 text-[var(--muted)]">Quotes, payments, job progress, reviews, and verification updates.</p></div>
      <span className="rounded-full bg-[var(--green-bg)] px-3 py-1.5 text-xs font-bold text-[var(--green)]" aria-live="polite">{unreadCount} unread</span>
    </div>
    {isError && <p role="alert" className="mb-4 rounded-xl border border-[var(--border)] p-4">Notifications could not be refreshed. <button type="button" className="font-bold text-[var(--clay)] underline" onClick={() => void refetch()}>Try again</button></p>}
    {items.length === 0 ? <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--muted)]">No notifications yet.</div> :
      <div className="grid gap-3">
        {items.map(item => <Link className={`group grid grid-cols-[44px_minmax(0,1fr)_20px] items-start gap-4 rounded-2xl border bg-[var(--surface)] p-4 text-[var(--ink)] transition-colors hover:border-[var(--clay)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--clay)] sm:p-5 ${item.read ? "border-[var(--border)]" : "border-[var(--clay)]/40"}`} href={item.href} key={item.id} onClick={() => { if (!item.read) markRead.mutate({ id: item.id }); }}>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--canvas)] text-[var(--clay)]"><Icon name={iconByType[item.type]} size={20} /></span>
          <span className="min-w-0"><span className="text-xs font-semibold capitalize text-[var(--muted)]">{item.type} · {new Date(item.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</span><strong className="mt-1 block text-base">{item.title}</strong><span className="mt-1 block text-sm leading-6 text-[var(--muted)]">{item.body}</span></span>
          <span aria-hidden="true" className="pt-2 text-[var(--muted)] transition-transform group-hover:translate-x-1">→</span>
        </Link>)}
      </div>}
  </section>;
}
