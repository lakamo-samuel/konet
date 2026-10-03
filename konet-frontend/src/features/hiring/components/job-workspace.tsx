"use client";
import { useDataCommand, useDataQuery } from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/data/access/client";
import { formatNaira } from "@/lib/formatters/currency";
import { ReasonAction } from "./reason-action";
import { MilestoneWorkspace } from "./milestone-workspace";
import type { HiringJob } from "@/types/hiring";
export function JobWorkspace({ id }: { id: string }) {
  const job = useDataQuery("job", { id }, undefined, {
    refetchInterval: 15000,
  });
  const user = useDataQuery("currentUser", {});
  if (job.isPending || user.isPending) return <p role="status">Loading job…</p>;
  if (job.isError || user.isError)
    return <p role="alert">{errorMessage(job.error ?? user.error)}</p>;
  if (!job.data) return <p>Job unavailable.</p>;
  return (
    <JobDetails
      job={job.data}
      client={job.data.clientId === user.data.id}
      provider={job.data.providerId === user.data.providerProfileId}
    />
  );
}
function JobDetails({
  job,
  client,
  provider,
}: {
  job: HiringJob;
  client: boolean;
  provider: boolean;
}) {
  const request = useDataQuery("request", { id: job.requestId });
  const quote = useDataQuery("quote", { id: job.quoteId });
  const start = useDataCommand("startJob");
  const complete = useDataCommand("markJobComplete");
  const confirm = useDataCommand("confirmCompletion");
  const cancel = useDataCommand("cancelJob");
  return (
    <div className="form-stack">
      <article className="surface-panel">
        <h2>Job {job.id.slice(0, 8)}</h2>
        <p>Status: {job.status.replaceAll("_", " ")}</p>
        <p>Agreed amount: {formatNaira(job.agreedAmountMinor / 100)}</p>
        {request.data && (
          <>
            <p>{request.data.description}</p>
            <p>{request.data.location || "Location to be agreed"}</p>
          </>
        )}
        {quote.data && (
          <>
            <h3>Agreed scope</h3>
            <ul>
              {quote.data.scope.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            {quote.data.deliveryAt && (
              <p>
                Delivery: {new Date(quote.data.deliveryAt).toLocaleString()}
              </p>
            )}
          </>
        )}
        {(request.isError || quote.isError) && (
          <p role="alert">{errorMessage(request.error ?? quote.error)}</p>
        )}
        {job.scheduledAt && (
          <p>Scheduled: {new Date(job.scheduledAt).toLocaleString()}</p>
        )}
        {job.status === "awaiting_payment" && (
          <p role="status">
            Payment is required before work can start. This job has not been
            marked as funded.
          </p>
        )}
        {job.status === "completed" && (
          <p>
            Work is confirmed complete. Payment release follows the payment
            provider’s confirmed transfer status.
          </p>
        )}
      </article>
      <MilestoneWorkspace job={job} provider={provider} />
      {provider && job.status === "scheduled" && (
        <Button
          disabled={start.isPending}
          onClick={() => start.mutate({ jobId: job.id })}
        >
          {start.isPending ? "Starting…" : "Start work"}
        </Button>
      )}
      {provider && job.status === "in_progress" && (
        <Button
          disabled={complete.isPending}
          onClick={() => complete.mutate({ jobId: job.id })}
        >
          {complete.isPending ? "Submitting…" : "Submit completed work"}
        </Button>
      )}
      {client && job.status === "awaiting_client_confirmation" && (
        <div>
          <p>
            Confirm only after reviewing the delivered work. Confirmation queues
            the provider’s payout.
          </p>
          <Button
            disabled={confirm.isPending}
            onClick={() => confirm.mutate({ jobId: job.id })}
          >
            {confirm.isPending ? "Confirming…" : "Confirm completed work"}
          </Button>
        </div>
      )}
      {[start, complete, confirm].map(
        (mutation, i) =>
          mutation.isError && (
            <p role="alert" key={i}>
              {errorMessage(mutation.error)}
            </p>
          ),
      )}
      {(client || provider) && job.status === "awaiting_payment" && (
        <ReasonAction
          label="Cancel unpaid job"
          pending={cancel.isPending}
          action={(reason) => cancel.mutateAsync({ jobId: job.id, reason })}
        />
      )}
      <Button href={`/requests/${job.requestId}`} variant="secondary">
        View original request
      </Button>
      <Button href="/jobs" variant="secondary">
        Back to jobs
      </Button>
    </div>
  );
}
