"use client";
import { formatDateTime } from "@/lib/formatters/date";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDataQuery, useDataCommand } from "@/lib/query/hooks";
import { errorCode, errorMessage } from "@/data/access/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CollectionPagination } from "@/components/ui/collection-pagination";
import { CollectionToolbar } from "@/components/ui/collection-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { WorkspaceSkeleton } from "@/components/ui/workspace-skeleton";
import Icon from "@/components/ui/icon";
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
  const statusOptions = [
    { value: "", label: "All statuses" },
    ...Object.entries(labels).map(([value, label]) => ({ value, label })),
  ];
  return (
    <div className="form-stack collection-page">
      <CollectionToolbar
        actions={
          <Button
            variant="secondary"
            onClick={() => void cases.refetch()}
            disabled={cases.isFetching}
          >
            {cases.isFetching ? "Refreshing…" : "Refresh cases"}
          </Button>
        }
      >
        <label className="collection-filter">
          <span>Status</span>
          <Select
            label="Dispute status"
            options={statusOptions}
            value={status ?? ""}
            onValueChange={(value) => {
              setStatus(value ? (value as DisputeStatus) : undefined);
              setOffset(0);
            }}
          />
        </label>
      </CollectionToolbar>
      {cases.isPending && <WorkspaceSkeleton variant="disputes" />}
      {cases.isError && (
        <div className="collection-error" role="alert">
          <p>{errorMessage(cases.error)}</p>
          <Button variant="secondary" onClick={() => void cases.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {cases.isSuccess && !cases.data.length && (
        <EmptyState
          icon="shield"
          className="dispute-empty-state"
          title={
            status
              ? `No ${labels[status].toLowerCase()} disputes`
              : offset
                ? "No cases on this page"
                : "You're all clear"
          }
          description={
            status
              ? "Try another status to see the rest of your cases."
              : offset
                ? "There are no cases in this part of the list. Go back to the previous page to see your other cases."
                : "There are no open cases on your account. If a funded job needs review, its case and updates will appear here."
          }
          action={
            !status && !offset ? (
              <Button href="/jobs" variant="secondary">
                View my jobs
              </Button>
            ) : undefined
          }
        />
      )}
      {cases.data?.map((item) => {
        const tone =
          item.status === "open" || item.status === "under_review"
            ? "amber"
            : item.status === "closed"
              ? "neutral"
              : "green";
        return (
          <article className="surface-panel dispute-record" key={item.id}>
            <div className="dispute-record-heading">
              <div>
                <p className="dispute-record-kicker">
                  Case opened {formatDateTime(item.createdAt)}
                </p>
                <h2>{item.reason}</h2>
              </div>
              <Badge tone={tone} icon={tone === "neutral" ? "check" : "shield"}>
                {labels[item.status]}
              </Badge>
            </div>
            <p className="dispute-record-description">{item.description}</p>
            <div className="dispute-record-footer">
              <span>Job {item.jobId.slice(0, 8)}</span>
              <Button href={`/disputes/${item.id}`} variant="secondary">
                View case <Icon name="arrow" size={16} />
              </Button>
            </div>
          </article>
        );
      })}
      {cases.isSuccess && (offset > 0 || cases.data.length > 0) && (
        <CollectionPagination
          offset={offset}
          count={cases.data.length}
          isFetching={cases.isFetching}
          onOffsetChange={setOffset}
          itemName="cases"
        />
      )}
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
          <EmptyState
            icon="shield"
            className="decision-history-empty"
            title="No decision recorded yet"
            description="Case decisions and their outcomes will appear here once a reviewer completes the review."
          />
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
    </div>
  );
}
