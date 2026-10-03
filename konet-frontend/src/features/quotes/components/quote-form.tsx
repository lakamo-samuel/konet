"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/data/access/client";
import { useDataCommand, useDataQuery } from "@/lib/query/hooks";
import { ngnToMinor, futureDate } from "@/lib/formatters/money-input";
import { previewCommission } from "@/lib/formatters/commission";
import { formatNaira } from "@/lib/formatters/currency";
export function QuoteForm({ requestId }: { requestId: string }) {
  const [amount, setAmount] = useState("");
  const policy = useDataQuery("commissionPolicy", {});
  let preview: ReturnType<typeof previewCommission> | undefined;
  try {
    const minor = ngnToMinor(amount);
    if (minor && policy.data) preview = previewCommission(minor, policy.data);
  } catch {
    /* Invalid or incomplete input is handled on submit. */
  }
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState("");
  const create = useDataCommand("createQuote");
  if (sent)
    return (
      <div className="surface-panel">
        <h2>Quote sent</h2>
        <Button href={`/quotes/${sent}`}>View quote</Button>
        <Button type="button" variant="secondary" onClick={() => setSent(null)}>
          Create another quote
        </Button>
      </div>
    );
  return (
    <form
      className="surface-panel form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        if (create.isPending || !policy.isSuccess) return;
        setError("");
        const data = new FormData(event.currentTarget);
        try {
          const amountMinor = ngnToMinor(String(data.get("amount")))!;
          if (amountMinor < 1)
            throw new Error("Enter a positive quote amount.");
          const scope = String(data.get("scope"))
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
          if (
            !scope.length ||
            scope.length > 50 ||
            scope.some((s) => s.length > 2000)
          )
            throw new Error(
              "Provide 1–50 deliverables, up to 2,000 characters each.",
            );
          const result = await create.mutateAsync({
            requestId,
            amountMinor,
            scope,
            notes: String(data.get("notes") ?? "").trim() || undefined,
            expiresAt: futureDate(String(data.get("expiresAt")))!,
            deliveryAt: futureDate(String(data.get("deliveryAt") ?? "")),
          });
          setSent(result.id);
        } catch (cause) {
          setError(errorMessage(cause));
        }
      }}
    >
      <h2>Send a quote</h2>
      <label className="field">
        Total price (₦)
        <input
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      {policy.isPending && <p role="status">Loading commission policy…</p>}
      {policy.isError && (
        <p role="alert">
          {errorMessage(policy.error)}{" "}
          <Button
            type="button"
            variant="secondary"
            onClick={() => policy.refetch()}
          >
            Retry
          </Button>
        </p>
      )}
      {policy.data && (
        <p>
          Konet deducts {policy.data.commissionBasisPoints / 100}% commission
          when payment is released. Konet covers transaction fees; the client
          pays your quoted total.
        </p>
      )}
      {preview && (
        <p aria-live="polite">
          Commission: {formatNaira(preview.platformFeeMinor / 100)} · Your
          expected earnings: {formatNaira(preview.providerAmountMinor / 100)}
        </p>
      )}
      <label className="field">
        Scope and deliverables
        <textarea
          name="scope"
          rows={5}
          required
          placeholder="One deliverable per line"
        />
      </label>
      <label className="field">
        Quote expires at
        <input name="expiresAt" type="datetime-local" required />
      </label>
      <label className="field">
        Delivery date (optional)
        <input name="deliveryAt" type="datetime-local" />
      </label>
      <label className="field">
        Note to client
        <textarea name="notes" maxLength={10000} />
      </label>
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={create.isPending || !policy.isSuccess}>
        {create.isPending ? "Sending…" : "Send quote"}
      </Button>
    </form>
  );
}
