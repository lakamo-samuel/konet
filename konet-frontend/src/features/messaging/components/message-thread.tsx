"use client";
import { formatDateTime } from "@/lib/formatters/date";
import { useEffect, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useDataQuery } from "@/lib/query/hooks";
import { query, errorMessage } from "@/data/access/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DeliveryError } from "@/lib/realtime/connection";
import {
  historyKey,
  liveMessageKey,
  receiptKey,
  useRealtime,
} from "@/lib/realtime/provider";
import { mergeMessages } from "@/lib/realtime/messages";
import type { Message } from "@/types/domain";
import type { ReadReceipt } from "@/types/messaging";
export function MessageThread({ conversationId }: { conversationId: string }) {
  const conversation = useDataQuery("conversation", { id: conversationId });
  const user = useDataQuery("currentUser", {});
  const realtime = useRealtime();
  const cache = useQueryClient();
  const history = useInfiniteQuery({
    queryKey: historyKey(conversationId),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      query(
        "messages",
        { conversationId, offset: pageParam, limit: 100 },
        signal,
      ),
    getNextPageParam: (last, pages) =>
      last.length === 100 ? pages.length * 100 : undefined,
    enabled: !!conversation.data && !!user.data,
  });
  const live = useQuery<Message[]>({
    queryKey: liveMessageKey(conversationId),
    queryFn: () => [],
    enabled: false,
  });
  const receipts = useQuery<ReadReceipt[]>({
    queryKey: receiptKey(conversationId),
    queryFn: () => [],
    enabled: false,
  });
  const messages = mergeMessages(
    ...(history.data?.pages ?? []),
    live.data ?? [],
  );
  const [text, setText] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const lastRead = useRef("");
  const latest = messages.at(-1)?.id ?? "";
  const end = useRef<HTMLDivElement>(null);
  const send = useMutation({
    retry: false,
    mutationFn: (content: string) => {
      if (!realtime.connection)
        throw new Error("Connect to live chat before sending.");
      return realtime.connection.send(conversationId, content);
    },
    onSuccess: () => {
      setText("");
      setUncertain(false);
    },
    onError: (error) => {
      if (error instanceof DeliveryError && error.uncertain) setUncertain(true);
    },
  });
  const { refetch, fetchNextPage } = history;
  useEffect(() => {
    if (!conversation.data || !realtime.connection) return;
    return realtime.connection.watchConversation(conversationId, () => {
      void refetch();
    });
  }, [conversationId, conversation.data, realtime.connection, refetch]);
  useEffect(() => {
    if (history.hasNextPage && !history.isFetching && !history.isError)
      void fetchNextPage();
  }, [history.hasNextPage, history.isFetching, history.isError, fetchNextPage]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [latest]);
  useEffect(() => {
    if (
      realtime.status !== "connected" ||
      !realtime.connection ||
      !history.isSuccess ||
      history.isFetching ||
      history.hasNextPage
    )
      return;
    const read = () => {
      if (document.visibilityState !== "visible" || lastRead.current === latest)
        return;
      void realtime
        .connection!.read(conversationId)
        .then(() => {
          lastRead.current = latest;
          void cache.invalidateQueries({
            queryKey: ["konet", "notifications"],
          });
        })
        .catch(() => undefined);
    };
    const timer = setTimeout(read, 500);
    document.addEventListener("visibilitychange", read);
    window.addEventListener("focus", read);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", read);
      window.removeEventListener("focus", read);
    };
  }, [
    conversationId,
    latest,
    realtime.connection,
    realtime.status,
    history.isSuccess,
    history.isFetching,
    history.hasNextPage,
    cache,
  ]);
  async function recover() {
    setRecoveryError("");
    try {
      const result = await refetch();
      if (result.isError) throw result.error;
      setUncertain(false);
      send.reset();
    } catch (error) {
      setRecoveryError(errorMessage(error));
    }
  }
  if (conversation.isPending || user.isPending)
    return <p role="status">Loading conversation…</p>;
  if (conversation.isError || user.isError)
    return <p role="alert">{errorMessage(conversation.error ?? user.error)}</p>;
  if (!conversation.data) return <p>Conversation unavailable.</p>;
  const c = conversation.data;
  const readByOther =
    receipts.data?.filter((r) => r.userId !== user.data.id) ?? [];
  return (
    <div className="form-stack">
      <Button href="/messages" variant="secondary">
        Back to inbox
      </Button>
      <section className="surface-panel form-stack">
        <h1>
          {c.jobId
            ? `Job ${c.jobId.slice(0, 8)}`
            : `Conversation ${c.id.slice(0, 8)}`}
        </h1>
        <p role="status">{realtime.message}</p>
        {realtime.status !== "connected" && (
          <Button variant="secondary" onClick={realtime.connection?.reconnect}>
            Reconnect
          </Button>
        )}
        {c.jobId && (
          <Button href={`/jobs/${c.jobId}`} variant="secondary">
            View job
          </Button>
        )}
        {c.requestId && (
          <Button href={`/requests/${c.requestId}`} variant="secondary">
            View request
          </Button>
        )}
      </section>
      <section
        className="surface-panel flex min-h-[380px] max-h-[600px] flex-col gap-4 overflow-y-auto"
        aria-label="Conversation messages"
        aria-live="polite"
      >
        {history.isPending && <p role="status">Loading message history…</p>}
        {history.isFetching && history.hasNextPage && (
          <p role="status">
            Loading more history… {messages.length} messages loaded.
          </p>
        )}
        {history.isError && <p role="alert">{errorMessage(history.error)}</p>}
        {history.isSuccess && !messages.length && (
          <EmptyState
            icon="message"
            className="message-empty-state"
            title="Start the conversation"
            description="Messages and job updates will appear here."
          />
        )}
        {messages.map((m) =>
          m.type === "system" ? (
            <p key={m.id} className="text-center text-sm text-[var(--muted)]">
              {m.content}
            </p>
          ) : (
            <article
              key={m.id}
              className={`max-w-[85%] rounded-2xl p-3 ${m.senderId === user.data.id ? "self-end bg-[var(--clay)] text-white" : "self-start bg-[var(--canvas)]"}`}
            >
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
              <time className="text-xs" dateTime={m.createdAt}>
                {formatDateTime(m.createdAt)}
              </time>
              {m.senderId === user.data.id &&
                readByOther.some(
                  (r) => Date.parse(r.readAt) >= Date.parse(m.createdAt),
                ) && <p className="text-xs">Read by the other participant</p>}
            </article>
          ),
        )}
        <div ref={end} />
      </section>
      <Button
        variant="secondary"
        disabled={history.isFetching}
        onClick={recover}
      >
        Reload history
      </Button>
      {uncertain && (
        <p role="alert">
          Delivery is uncertain. Reload history and check whether your message
          arrived before sending it again.
        </p>
      )}
      {recoveryError && <p role="alert">{recoveryError}</p>}
      <form
        className="form-stack surface-panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (!send.isPending && !uncertain) send.mutate(text.trim());
        }}
      >
        <label className="field">
          Message
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={10000}
            disabled={send.isPending}
            placeholder="Write a message"
          />
        </label>
        <Button
          type="submit"
          disabled={
            realtime.status !== "connected" ||
            send.isPending ||
            uncertain ||
            !text.trim() ||
            history.isPending ||
            history.isFetching ||
            history.hasNextPage ||
            history.isError
          }
        >
          {send.isPending ? "Sending…" : "Send message"}
        </Button>
        {send.isError && <p role="alert">{errorMessage(send.error)}</p>}
      </form>
    </div>
  );
}
