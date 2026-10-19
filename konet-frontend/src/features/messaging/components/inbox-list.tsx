"use client";
import { formatDateTime } from "@/lib/formatters/date";
import { useState } from "react";
import { useDataQuery } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { Button } from "@/components/ui/button";
import { WorkspaceSkeleton } from "@/components/ui/workspace-skeleton";
import { CollectionPagination } from "@/components/ui/collection-pagination";
import { CollectionToolbar } from "@/components/ui/collection-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import Icon from "@/components/ui/icon";
import Link from "next/link";
import { useRealtime } from "@/lib/realtime/provider";
export function InboxList() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const user = useDataQuery("currentUser", {});
  const inbox = useDataQuery(
    "conversations",
    { userId: user.data?.id ?? "", offset },
    undefined,
    { enabled: !!user.data },
  );
  const realtime = useRealtime();
  const rows =
    inbox.data?.filter((c) =>
      `${c.id} ${c.jobId ?? ""} ${c.requestId ?? ""}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    ) ?? [];
  if (user.isError || inbox.isError) {
    return (
      <section className="surface-panel form-stack">
        <h2>Inbox</h2>
        <p role="alert">{errorMessage(user.error ?? inbox.error)}</p>
      </section>
    );
  }
  if (user.isPending || inbox.isPending) {
    return <WorkspaceSkeleton variant="messages" />;
  }
  return (
    <section className="form-stack messages-inbox">
      <CollectionToolbar
        actions={
          realtime.status === "error" ? (
            <Button
              variant="secondary"
              onClick={realtime.connection?.reconnect}
            >
              Reconnect live updates
            </Button>
          ) : (
            <span
              className={`realtime-indicator ${realtime.status === "connected" ? "connected" : ""}`}
              role="status"
            >
              <span /> {realtime.message || "Live updates ready"}
            </span>
          )
        }
      >
        <label className="collection-filter collection-search">
          <span>Search conversations on this page</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Job, request or conversation ID"
        />
        </label>
      </CollectionToolbar>
      {rows.map((c) => (
        <Link key={c.id} href={`/messages/${c.id}`} className="conversation-card">
          <span className="conversation-card-icon"><Icon name="message" size={20} /></span>
          <div className="conversation-card-copy">
            <strong>
              {c.jobId
                ? `Job ${c.jobId.slice(0, 8)}`
                : c.requestId
                  ? `Request ${c.requestId.slice(0, 8)}`
                  : `Conversation ${c.id.slice(0, 8)}`}
            </strong>
            <span>{c.jobId ? "Job conversation" : c.requestId ? "Request conversation" : "Direct conversation"}</span>
            <p>Updated {formatDateTime(c.updatedAt)}</p>
          </div>
          <Icon name="arrow" size={18} />
        </Link>
      ))}
      {inbox.isSuccess && !rows.length && (
        <EmptyState
          icon="message"
          title={inbox.data.length ? "No matching conversations" : "Your inbox is clear"}
          description={inbox.data.length ? "Try a different job or request reference." : "A conversation appears here when a quote is accepted."}
        />
      )}
      {(offset > 0 || inbox.data.length > 0) && (
        <CollectionPagination
          offset={offset}
          count={inbox.data.length}
          isFetching={inbox.isFetching}
          onOffsetChange={setOffset}
          itemName="conversations"
        />
      )}
    </section>
  );
}
