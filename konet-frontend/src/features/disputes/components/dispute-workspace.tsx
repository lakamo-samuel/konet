"use client";
import { formatDateTime } from "@/lib/formatters/date";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDataQuery, useDataCommand } from "@/lib/query/hooks";
import { errorCode, errorMessage } from "@/data/access/client";
import { Button } from "@/components/ui/button";
import { PaymentPanel } from "@/features/payments/components/payment-panel";
import { formatNaira } from "@/lib/formatters/currency";
import type { DisputeStatus } from "@/types/disputes";
const labels: Record<DisputeStatus, string> = {
  open: "Open",
  under_review: "Under review",
  resolved_for_client: "Resolved for client",
  resolved_for_provider: "Resolved for provider",
  closed: "Closed",
};
export function DisputeList() {
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<DisputeStatus | undefined>();
  const cases = useDataQuery("disputes", { offset, status });
  return (
    <div className="form-stack">
      <label className="field">
        Status
        <select
          value={status ?? ""}
          onChange={(event) => {
            setStatus(
              event.target.value
                ? (event.target.value as DisputeStatus)
                : undefined,
            );
            setOffset(0);
          }}
        >
          <option value="">All statuses</option>
          {Object.entries(labels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <Button
        variant="secondary"
        onClick={() => cases.refetch()}
        disabled={cases.isFetching}
      >
        Refresh cases
      </Button>
      {cases.isPending && <p role="status">Loading disputes…</p>}
      {cases.isError && <p role="alert">{errorMessage(cases.error)}</p>}
      {cases.isSuccess && !cases.data.length && (
        <p>No disputes on this page.</p>
      )}
      {cases.data?.map((item) => (
        <article className="surface-panel" key={item.id}>
          <h2>{item.reason}</h2>
          <p>
            {labels[item.status]} · Job {item.jobId.slice(0, 8)}
          </p>
          <p>{formatDateTime(item.createdAt)}</p>
          <Button href={`/disputes/${item.id}`}>View case</Button>
        </article>
      ))}
      <div className="modal-actions">
        <Button
          variant="secondary"
          disabled={!offset || cases.isFetching}
          onClick={() => setOffset(Math.max(0, offset - 20))}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          disabled={
            !cases.isSuccess || cases.data.length < 20 || cases.isFetching
          }
          onClick={() => setOffset(offset + 20)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
export function OpenDispute({ jobId }: { jobId: string }) {
  const job = useDataQuery("job", { id: jobId });
  const payment = useDataQuery("payment", { jobId });
  const open = useDataCommand("openDispute");
  const router = useRouter();
  const [failure, setFailure] = useState("");
  if (job.isPending || payment.isPending)
    return <p role="status">Loading job…</p>;
  if (job.isError || payment.isError)
    return <p role="alert">{errorMessage(job.error ?? payment.error)}</p>;
  const eligible =
    job.data &&
    ["scheduled", "in_progress", "awaiting_client_confirmation"].includes(
      job.data.status,
    ) &&
    ["funded", "held"].includes(payment.data.status);
  return (
    <div className="form-stack">
      {eligible ? (
        <form
          className="surface-panel form-stack"
          onSubmit={async (event) => {
            event.preventDefault();
            if (open.isPending) return;
            setFailure("");
            const values = new FormData(event.currentTarget);
            try {
              const item = await open.mutateAsync({
                jobId,
                reason: String(values.get("reason")).trim(),
                description: String(values.get("description")).trim(),
              });
              router.push(`/disputes/${item.id}`);
            } catch (cause) {
              setFailure(errorMessage(cause));
            }
          }}
        >
          <p>
            Opening a dispute pauses work completion and provider payout while
            an administrator reviews the case. Explain what happened and refer
            to relevant job messages.
          </p>
          <fieldset disabled={open.isPending} className="form-stack">
            <label className="field">
              Reason
              <input name="reason" required minLength={3} maxLength={100} />
            </label>
            <label className="field">
              Description
              <textarea
                name="description"
                required
                minLength={20}
                maxLength={5000}
                rows={8}
              />
            </label>
            <Button type="submit">
              {open.isPending ? "Opening…" : "Submit dispute"}
            </Button>
          </fieldset>
          {failure && <p role="alert">{failure}</p>}
        </form>
      ) : (
        <p>
          This job cannot accept a new dispute in its current payment or work
          state.
        </p>
      )}
      {(errorCode(open.error) === "DISPUTE_EXISTS" ||
        job.data?.status === "disputed") && (
        <p>
          An existing case may already cover this job. Open your dispute list to
          view it.
        </p>
      )}
      <Button href="/disputes" variant="secondary">
        Your disputes
      </Button>
      <Button href={`/jobs/${jobId}`} variant="secondary">
        Back to job
      </Button>
    </div>
  );
}
export function DisputeDetail({ id }: { id: string }) {
  const item = useDataQuery("dispute", { id });
  const history = useDataQuery("disputeDecisions", { id }, undefined, {
    enabled: item.isSuccess,
  });
  if (item.isPending) return <p role="status">Loading case…</p>;
  if (item.isError)
    return (
      <p role="alert">
        {errorMessage(item.error)}{" "}
        <Button variant="secondary" onClick={() => item.refetch()}>
          Retry
        </Button>
      </p>
    );
  const dispute = item.data;
  return (
    <div className="form-stack">
      <article className="surface-panel">
        <h2>{dispute.reason}</h2>
        <p>{labels[dispute.status]}</p>
        <p className="whitespace-pre-wrap">{dispute.description}</p>
        <p>Opened {formatDateTime(dispute.createdAt)}</p>
        {dispute.resolvedAt && (
          <p>Resolved {formatDateTime(dispute.resolvedAt)}</p>
        )}
      </article>
      {["open", "under_review"].includes(dispute.status) && (
        <p>
          Provider payout is paused pending a decision. Neither participant can
          resolve this case.
        </p>
      )}
      <section className="surface-panel">
        <h2>Decision history</h2>
        {history.isPending && <p role="status">Loading decisions…</p>}
        {history.isError && <p role="alert">{errorMessage(history.error)}</p>}
        {history.isSuccess && !history.data.length && (
          <p>No decision recorded yet.</p>
        )}
        {history.data?.map((decision) => (
          <article key={decision.id}>
            <h3>{labels[decision.decision]}</h3>
            <p>{decision.reason}</p>
            {decision.refundAmountMinor !== null && (
              <p>
                Authorized refund:{" "}
                {formatNaira(decision.refundAmountMinor / 100)}
              </p>
            )}
            <p>{formatDateTime(decision.createdAt)}</p>
          </article>
        ))}
      </section>
      <p>
        A resolution authorizes a refund or payout. Actual payment completion is
        shown below.
      </p>
      <PaymentPanel jobId={dispute.jobId} />
      <Button
        variant="secondary"
        onClick={() => {
          void item.refetch();
          void history.refetch();
        }}
      >
        Refresh case
      </Button>
      <Button href={`/jobs/${dispute.jobId}`} variant="secondary">
        View job
      </Button>
      <Button href="/disputes" variant="secondary">
        Back to disputes
      </Button>
    </div>
  );
}
