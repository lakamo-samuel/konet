"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/data/access/client";
import { useDataCommand } from "@/lib/query/hooks";
export function QuoteForm({ requestId, minimum }: { requestId: string; minimum: number }) {
  const [sent, setSent] = useState(false);
  const create = useDataCommand("createQuote");
  if (sent) return <div className="surface-panel success-state"><h2>Quote sent</h2><p>The client can review your scope and total before accepting.</p><Button href="/provider/requests">Back to requests</Button></div>;
  return <form className="surface-panel form-stack" onSubmit={async event => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const scope = String(values.get("scope") ?? "").split("\n").map(line => line.trim()).filter(Boolean);
    try { await create.mutateAsync({ requestId, amount: Number(values.get("amount")), scope, note: String(values.get("note") ?? "") }); setSent(true); } catch { /* Error is shown below. */ }
  }}><h2>Send a quote</h2><label className="field">Total price (₦)<input name="amount" type="number" min={minimum} required defaultValue={minimum} /></label><label className="field">Scope and deliverables<textarea name="scope" rows={5} required placeholder={"One deliverable per line\nInclude delivery timing"} /></label><label className="field">Note to client<textarea name="note" rows={3} placeholder="Share any useful details or conditions." /></label>{create.isError && <p role="alert" className="field-error">{errorMessage(create.error)}</p>}<Button type="submit" disabled={create.isPending}>{create.isPending ? "Sending…" : "Send quote"}</Button></form>;
}
