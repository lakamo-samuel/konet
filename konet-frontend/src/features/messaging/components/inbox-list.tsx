"use client";
import { formatDateTime } from "@/lib/formatters/date";
import { useState } from "react";
import { useDataQuery } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { Button } from "@/components/ui/button";
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
  return (
    <section className="surface-panel form-stack">
      <h2>Inbox</h2>
      <p role="status">{realtime.message}</p>
      {realtime.status === "error" && (
        <Button variant="secondary" onClick={realtime.connection?.reconnect}>
          Reconnect
        </Button>
      )}
      <label className="field">
        Search conversations on this page
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Job, request or conversation ID"
        />
      </label>
      {(user.isError || inbox.isError) && (
        <p role="alert">{errorMessage(user.error ?? inbox.error)}</p>
      )}
      {!user.isError && inbox.isPending && (
        <p role="status">Loading conversations…</p>
      )}
      {rows.map((c) => (
        <article key={c.id} className="notification-row">
          <div>
            <Button variant="quiet" href={`/messages/${c.id}`}>
              {c.jobId
                ? `Job ${c.jobId.slice(0, 8)}`
                : c.requestId
                  ? `Request ${c.requestId.slice(0, 8)}`
                  : `Conversation ${c.id.slice(0, 8)}`}
            </Button>
            <p>Updated {formatDateTime(c.updatedAt)}</p>
          </div>
        </article>
      ))}
      {inbox.isSuccess && !rows.length && (
        <p>
          {inbox.data.length
            ? "No conversations match this search."
            : "No conversations on this page. A conversation is created when a quote is accepted."}
        </p>
      )}
      <div className="modal-actions">
        <Button
          variant="secondary"
          disabled={!offset || inbox.isFetching}
          onClick={() => setOffset(Math.max(0, offset - 20))}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          disabled={inbox.data?.length !== 20 || inbox.isFetching}
          onClick={() => setOffset(offset + 20)}
        >
          Next
        </Button>
      </div>
    </section>
  );
}
