"use client";
import { useEffect, useRef } from "react";
import { useDataCommand, useDataQuery } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/formatters/currency";
import { paymentLabel } from "@/lib/formatters/payment";
import type { Payment } from "@/types/payments";
export function PaymentPanel({
  jobId,
  reference,
  autoVerify = false,
}: {
  jobId: string;
  reference?: string;
  autoVerify?: boolean;
}) {
  const payment = useDataQuery("payment", { jobId }, undefined, {
    refetchInterval: 10000,
  });
  const verify = useDataCommand("verifyPayment");
  const attempted = useRef(false);
  const matches = !reference || payment.data?.gatewayReference === reference;
  const verifiable =
    !!payment.data?.gatewayReference &&
    ["pending", "processing", "failed"].includes(payment.data.status);
  const { mutate } = verify;
  useEffect(() => {
    if (autoVerify && matches && verifiable && !attempted.current) {
      attempted.current = true;
      mutate({ jobId });
    }
  }, [autoVerify, matches, verifiable, jobId, mutate]);
  if (payment.isPending) return <p role="status">Loading payment…</p>;
  if (payment.isError) return <p role="alert">{errorMessage(payment.error)}</p>;
  if (!matches)
    return (
      <p role="alert">
        This reference does not match the job’s payment. Open the job from your
        job list to check its payment.
      </p>
    );
  const p = payment.data;
  return (
    <section className="surface-panel form-stack">
      <h2>{paymentLabel[p.status]}</h2>
      <p>
        {formatNaira(p.amountMinor / 100)} · {p.currency}
      </p>
      {p.gatewayReference && <p>Reference: {p.gatewayReference}</p>}
      {["pending", "processing", "failed"].includes(p.status) && (
        <p>
          Work can start once the backend confirms payment. If you already paid,
          verify the existing transaction before retrying checkout.
        </p>
      )}
      {p.status === "release_pending" && (
        <p>
          The provider’s payout is queued. A successful transfer has not been
          confirmed yet.
        </p>
      )}
      {p.status === "disputed" && (
        <p>This payment needs review. Follow the job’s dispute updates.</p>
      )}
      {verifiable && (
        <Button
          disabled={verify.isPending}
          onClick={() => verify.mutate({ jobId })}
        >
          {verify.isPending ? "Verifying…" : "Verify payment"}
        </Button>
      )}
      {verify.isError && <p role="alert">{errorMessage(verify.error)}</p>}
      {verify.isSuccess &&
        ["pending", "processing", "failed"].includes(verify.data.status) && (
          <p role="status">
            Payment is not confirmed yet. Check again shortly or contact support
            with this reference.
          </p>
        )}
      {p.status === "release_pending" || p.status === "released" ? (
        <SettlementDetails jobId={jobId} />
      ) : null}
      <RefundDetails jobId={jobId} />
    </section>
  );
}
function SettlementDetails({ jobId }: { jobId: string }) {
  const payout = useDataQuery("payout", { jobId }, undefined, {
    refetchInterval: 15000,
  });
  if (payout.isError) return <p role="alert">{errorMessage(payout.error)}</p>;
  return payout.data ? (
    <p>
      Payout: {payout.data.status} ·{" "}
      {formatNaira(payout.data.amountMinor / 100)}
    </p>
  ) : (
    <p>Loading payout…</p>
  );
}
function RefundDetails({ jobId }: { jobId: string }) {
  const refunds = useDataQuery("refunds", { jobId }, undefined, {
    refetchInterval: 15000,
  });
  if (refunds.isError) return <p role="alert">{errorMessage(refunds.error)}</p>;
  return (
    <>
      {refunds.data?.map((r) => (
        <p key={r.id}>
          Refund: {r.status} · {formatNaira(r.amountMinor / 100)} · {r.reason}
        </p>
      ))}
    </>
  );
}
export function PaymentRow({ payment }: { payment: Payment }) {
  return (
    <article className="transaction-row">
      <div className="transaction-icon">₦</div>
      <div>
        <Button variant="quiet" href={`/jobs/${payment.jobId}`}>
          Job {payment.jobId.slice(0, 8)}
        </Button>
        <p>{paymentLabel[payment.status]}</p>
      </div>
      <span>{new Date(payment.createdAt).toLocaleDateString()}</span>
      <b>{formatNaira(payment.amountMinor / 100)}</b>
    </article>
  );
}
