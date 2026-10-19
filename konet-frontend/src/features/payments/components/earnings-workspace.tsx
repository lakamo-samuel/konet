"use client";
import { formatDate } from "@/lib/formatters/date";
import { useState } from "react";
import { useDataQuery } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { formatNaira } from "@/lib/formatters/currency";
import { Button } from "@/components/ui/button";
import { PaymentRow } from "./payment-panel";
import { PayoutAccountForm } from "./payout-account-form";
import { CollectionPagination } from "@/components/ui/collection-pagination";
import { EmptyState } from "@/components/ui/empty-state";
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
              {formatDate(p.createdAt)}
            </p>
            <p>Reference: {p.reference}</p>
          </article>
        ))}
        {payouts.isSuccess && !payouts.data.length && (
          <EmptyState
            icon="shield"
            title="No payouts yet"
            description="Completed provider earnings and transfer updates will appear here."
          />
        )}
        {payouts.isSuccess && (payoutOffset > 0 || payouts.data.length > 0) && (
          <CollectionPagination
            offset={payoutOffset}
            count={payouts.data.length}
            isFetching={payouts.isFetching}
            onOffsetChange={setPayoutOffset}
            itemName="payouts"
          />
        )}
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
          <EmptyState
            icon="briefcase"
            title="No payments yet"
            description="Payments for jobs you hire or provide will appear here."
          />
        )}
        {payments.isSuccess && (paymentOffset > 0 || payments.data.length > 0) && (
          <CollectionPagination
            offset={paymentOffset}
            count={payments.data.length}
            isFetching={payments.isFetching}
            onOffsetChange={setPaymentOffset}
            itemName="payments"
          />
        )}
      </section>
    </div>
  );
}
