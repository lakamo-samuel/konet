"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useDataQuery, dataKey } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { Button } from "@/components/ui/button";
import { ReviewForm } from "./review-form";
import { ReviewDisplay } from "./review-display";
export function ReviewWorkspace({ jobId }: { jobId: string }) {
  const job = useDataQuery("job", { id: jobId });
  const user = useDataQuery("currentUser", {});
  const review = useDataQuery("jobReview", { jobId }, undefined, {
    enabled: !!job.data && !!user.data,
  });
  const cache = useQueryClient();
  if (job.isError || user.isError)
    return <p role="alert">{errorMessage(job.error ?? user.error)}</p>;
  if (job.isPending || user.isPending) return <p role="status">Loading job…</p>;
  if (!job.data) return <p>Job unavailable.</p>;
  const client = job.data.clientId === user.data.id;
  return (
    <div className="form-stack">
      <p>Job {jobId.slice(0, 8)}</p>
      {review.isPending && <p role="status">Loading review…</p>}
      {review.isError && <p role="alert">{errorMessage(review.error)}</p>}
      {review.data && <ReviewDisplay review={review.data} />}
      {review.isSuccess &&
        review.data === null &&
        (job.data.status === "completed" && client ? (
          <ReviewForm
            jobId={jobId}
            onSaved={(saved) =>
              cache.setQueryData(dataKey("jobReview", { jobId }), saved)
            }
            onConflict={async () => {
              await review.refetch();
            }}
          />
        ) : (
          <p>
            {client
              ? "Reviews become available after you confirm completed work."
              : "The job’s client has not submitted a review. Only the client can review completed work."}
          </p>
        ))}
      <Button
        variant="secondary"
        disabled={review.isFetching}
        onClick={() => {
          void review.refetch();
        }}
      >
        {review.isFetching ? "Reloading…" : "Reload review"}
      </Button>
      <Button variant="secondary" href={`/jobs/${jobId}`}>
        Back to job
      </Button>
    </div>
  );
}
