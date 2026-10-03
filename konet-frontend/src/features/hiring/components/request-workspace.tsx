"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataCommand, useDataQuery } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { formatNaira } from "@/lib/formatters/currency";
import { QuoteForm } from "@/features/quotes/components/quote-form";
import { ReasonAction } from "./reason-action";
export function RequestWorkspace({ id }: { id: string }) {
  const [quoteOffset, setQuoteOffset] = useState(0);
  const request = useDataQuery("request", { id }, undefined, {
    refetchInterval: 15000,
  });
  const user = useDataQuery("currentUser", {});
  const quotes = useDataQuery(
    "requestQuotes",
    { requestId: id, offset: quoteOffset },
    undefined,
    {
      refetchInterval: 15000,
    },
  );
  const close = useDataCommand("closeRequest");
  if (request.isPending || user.isPending)
    return <p role="status">Loading request…</p>;
  if (request.isError || user.isError)
    return <p role="alert">{errorMessage(request.error ?? user.error)}</p>;
  const record = request.data;
  if (!record) return <p>Request unavailable.</p>;
  const client = record.clientId === user.data.id;
  const provider = record.providerId === user.data.providerProfileId;
  const open = ["pending", "viewed", "discussing", "quoted"].includes(
    record.status,
  );
  return (
    <div className="form-stack">
      <article className="surface-panel">
        <h2>Service request</h2>
        <p>{record.description}</p>
        <p>Status: {record.status.replaceAll("_", " ")}</p>
        <p>
          {record.requestedAt
            ? new Date(record.requestedAt).toLocaleString()
            : "No preferred date"}{" "}
          · {record.location || "Location to be agreed"}
        </p>
        <p>
          Budget:{" "}
          {record.budgetMinMinor === null
            ? "No minimum"
            : formatNaira(record.budgetMinMinor / 100)}{" "}
          –{" "}
          {record.budgetMaxMinor === null
            ? "No maximum"
            : formatNaira(record.budgetMaxMinor / 100)}
        </p>
      </article>
      {quotes.isError && <p role="alert">{errorMessage(quotes.error)}</p>}
      {quotes.data?.map((q) => (
        <article className="surface-panel" key={q.id}>
          <strong>
            {formatNaira(q.amountMinor / 100)} · {q.status}
          </strong>
          <p>Expires {new Date(q.expiresAt).toLocaleString()}</p>
          <Button href={`/quotes/${q.id}`} variant="secondary">
            View quote
          </Button>
        </article>
      ))}
      <div>
        <Button
          variant="secondary"
          disabled={quoteOffset === 0}
          onClick={() => setQuoteOffset(quoteOffset - 20)}
        >
          Previous quotes
        </Button>
        <Button
          variant="secondary"
          disabled={(quotes.data?.length ?? 0) < 20}
          onClick={() => setQuoteOffset(quoteOffset + 20)}
        >
          Next quotes
        </Button>
      </div>
      {provider && open && <QuoteForm requestId={id} />}
      {open && (client || provider) && (
        <ReasonAction
          label={client ? "Withdraw request" : "Decline request"}
          pending={close.isPending}
          action={(reason) =>
            close.mutateAsync({
              id,
              action: client ? "withdraw" : "decline",
              reason,
            })
          }
        />
      )}
      <Button
        href={provider ? "/provider/requests" : "/requests"}
        variant="secondary"
      >
        Back to requests
      </Button>
    </div>
  );
}
