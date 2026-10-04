"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { command } from "@/data/access/client";
import { useDataQuery } from "@/lib/query/hooks";
import { refreshSession } from "@/lib/auth/refresh-client";
import type { User } from "@/types/domain";
import type { Message } from "@/types/domain";
import type { ReadReceipt, ConnectionState } from "@/types/messaging";
import { RealtimeConnection } from "./connection";
import { mergeMessages } from "./messages";
const Context = createContext<RealtimeConnection | null>(null);
export const liveMessageKey = (id: string) =>
  ["konet", "liveMessages", id] as const;
export const receiptKey = (id: string) =>
  ["konet", "readReceipts", id] as const;
export const historyKey = (id: string) =>
  ["konet", "messageHistory", id] as const;
export function RealtimeProvider({ children, initialUser }: { children: ReactNode; initialUser: User | null }) {
  const user = useDataQuery("currentUser", {}, initialUser ?? undefined, { enabled: !!initialUser });
  const cache = useQueryClient();
  const userId = user.data?.id;
  const connection = useMemo(
    () =>
      userId
        ? new RealtimeConnection({
            ticket: () => command("realtimeTicket", {}),
            refresh: () => refreshSession(),
            onMessage: (message) => {
              cache.setQueryData<Message[]>(
                liveMessageKey(message.conversationId),
                (rows) => mergeMessages(rows ?? [], [message]),
              );
              void cache.invalidateQueries({
                queryKey: ["konet", "conversations"],
              });
            },
            onNotification: (payload) => {
              const names = ["notifications", "conversations"];
              if (
                payload &&
                typeof payload === "object" &&
                "resourceType" in payload &&
                payload.resourceType === "dispute"
              )
                names.push(
                  "disputes",
                  "dispute",
                  "disputeDecisions",
                  "job",
                  "payment",
                  "payout",
                  "refunds",
                );
              for (const name of names)
                void cache.invalidateQueries({ queryKey: ["konet", name] });
            },
            onReceipt: (receipt) => {
              cache.setQueryData<ReadReceipt[]>(
                receiptKey(receipt.conversationId),
                (rows) => [
                  ...(rows ?? []).filter((r) => r.userId !== receipt.userId),
                  receipt,
                ],
              );
              void cache.invalidateQueries({
                queryKey: ["konet", "notifications"],
              });
            },
            onReconnect: () => {
              for (const name of [
                "conversations",
                "notifications",
                "messageHistory",
                "disputes",
                "dispute",
                "disputeDecisions",
                "job",
                "payment",
                "payout",
                "refunds",
              ])
                void cache.invalidateQueries({ queryKey: ["konet", name] });
            },
          })
        : null,
    [userId, cache],
  );
  useEffect(() => {
    connection?.start();
    return () => connection?.stop();
  }, [connection]);
  return <Context.Provider value={connection}>{children}</Context.Provider>;
}
const pending: ConnectionState = {
  status: "connecting",
  message: "Connecting to live chat…",
};
const emptySubscribe = () => () => undefined;
export function useRealtime() {
  const connection = useContext(Context);
  const state = useSyncExternalStore(
    connection?.subscribe ?? emptySubscribe,
    connection?.snapshot ?? (() => pending),
    () => pending,
  );
  return { connection, ...state };
}
