"use client";
import { useState } from "react";
import { useDataQuery } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { formatNaira } from "@/lib/formatters/currency";
import { Button } from "@/components/ui/button";
import { PaymentRow } from "./payment-panel";
import { PayoutAccountForm } from "./payout-account-form";
export function EarningsWorkspace() {
  const earnings = useDataQuery("earnings", {}, undefined, {
    refetchInterval: 15000,
  });
  const [paymentOffset, setPaymentOffset] = useState(0);
  const [payoutOffset, setPayoutOffset] = useState(0);
  const payments = useDataQuery(
    "payments",
    { offset: paymentOffset },
    undefined,
    { refetchInterval: 15000 },
  );
  const payouts = useDataQuery("payouts", { offset: payoutOffset }, undefined, {
    refetchInterval: 15000,
  });
  return (
    <div className="form-stack">
      {earnings.isPending && <p role="status">Loading earnings…</p>}
      {earnings.isError && <p role="alert">{errorMessage(earnings.error)}</p>}
      {earnings.data && (
        <div className="earnings-hero">
          <div>
            <span>Earned on completed jobs</span>
            <strong>{formatNaira(earnings.data.earnedMinor / 100)}</strong>
            <small>Includes pending and paid payouts</small>
          </div>
          <div>
            <span>Awaiting payout</span>
            <strong>{formatNaira(earnings.data.pendingMinor / 100)}</strong>
            <small>Completed jobs awaiting transfer</small>
          </div>
          <div>
            <span>Paid out</span>
            <strong>{formatNaira(earnings.data.paidOutMinor / 100)}</strong>
            <small>Verified successful transfers</small>
          </div>
        </div>
      )}
      <PayoutAccountForm />
      <section className="workspace-card form-stack">
        <h2>Payout history</h2>
        {payouts.isPending && <p role="status">Loading payouts…</p>}
        {payouts.isError && <p role="alert">{errorMessage(payouts.error)}</p>}
        {payouts.data?.map((p) => (
          <article key={p.id}>
            <Button variant="quiet" href={`/jobs/${p.jobId}`}>
              Job {p.jobId.slice(0, 8)}
            </Button>
            <p>
              {formatNaira(p.amountMinor / 100)} · {p.status} ·{" "}
              {new Date(p.createdAt).toLocaleDateString()}
            </p>
            <p>Reference: {p.reference}</p>
          </article>
        ))}
        {payouts.isSuccess && !payouts.data.length && (
          <p>No payouts on this page.</p>
        )}
        <Pagination
          offset={payoutOffset}
          next={payouts.data?.length === 20}
          pending={payouts.isFetching}
          onChange={setPayoutOffset}
        />
      </section>
      <section className="workspace-card form-stack">
        <h2>Account payment history</h2>
        <p>
          Payments for jobs you hired or provided. Earnings totals above come
          from the full provider ledger.
        </p>
        {payments.isPending && <p role="status">Loading payments…</p>}
        {payments.isError && <p role="alert">{errorMessage(payments.error)}</p>}
        {payments.data?.map((p) => (
          <PaymentRow key={p.id} payment={p} />
        ))}
        {payments.isSuccess && !payments.data.length && (
          <p>No payments on this page.</p>
        )}
        <Pagination
          offset={paymentOffset}
          next={payments.data?.length === 20}
          pending={payments.isFetching}
          onChange={setPaymentOffset}
        />
      </section>
    </div>
  );
}
function Pagination({
  offset,
  next,
  pending,
  onChange,
}: {
  offset: number;
  next: boolean;
  pending: boolean;
  onChange: (offset: number) => void;
}) {
  return (
    <div className="modal-actions">
      <Button
        variant="secondary"
        disabled={!offset || pending}
        onClick={() => onChange(Math.max(0, offset - 20))}
      >
        Previous
      </Button>
      <Button
        variant="secondary"
        disabled={!next || pending}
        onClick={() => onChange(offset + 20)}
      >
        Next
      </Button>
    </div>
  );
}
