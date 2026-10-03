"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataCommand, useDataQuery } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { formatNaira } from "@/lib/formatters/currency";
import { QuoteActions } from "@/features/quotes/components/quote-actions";
import { ReasonAction } from "./reason-action";
export function QuoteWorkspace({ id }: { id: string }) {
  const [now, setNow] = useState(() => Date.now());
  const quote = useDataQuery("quote", { id }, undefined, {
    refetchInterval: 15000,
  });
  const user = useDataQuery("currentUser", {});
  const close = useDataCommand("closeQuote");
  useEffect(() => {
    if (quote.data?.status !== "sent") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [quote.data?.status]);
  if (quote.isPending || user.isPending)
    return <p role="status">Loading quote…</p>;
  if (quote.isError || user.isError)
    return <p role="alert">{errorMessage(quote.error ?? user.error)}</p>;
  const q = quote.data;
  if (!q) return <p>Quote unavailable.</p>;
  const client = q.clientId === user.data.id;
  const provider = q.providerId === user.data.providerProfileId;
  const available = q.status === "sent" && Date.parse(q.expiresAt) > now;
  return (
    <div className="surface-panel form-stack">
      <h2>{formatNaira(q.amountMinor / 100)}</h2>
      <p>Status: {q.status === "sent" && !available ? "expired" : q.status}</p>
      <p>Expires {new Date(q.expiresAt).toLocaleString()}</p>
      {q.deliveryAt && (
        <p>Delivery: {new Date(q.deliveryAt).toLocaleString()}</p>
      )}
      <h3>Included</h3>
      <ul>
        {q.scope.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
      <p>{q.notes || "No additional notes."}</p>
      {client && available && (
        <QuoteActions quoteId={id} available={available} />
      )}
      {available && (client || provider) && (
        <ReasonAction
          label={client ? "Decline quote" : "Cancel quote"}
          pending={close.isPending}
          action={(reason) =>
            close.mutateAsync({
              id,
              action: client ? "decline" : "cancel",
              reason,
            })
          }
        />
      )}
      <Button href={`/requests/${q.requestId}`} variant="secondary">
        View request
      </Button>
      <Button href="/jobs" variant="secondary">
        View jobs
      </Button>
    </div>
  );
}
