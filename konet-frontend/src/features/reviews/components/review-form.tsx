"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { errorCode, errorMessage } from "@/data/access/client";
import { useDataCommand } from "@/lib/query/hooks";
import type { Review } from "@/types/domain";
import { ReviewDisplay } from "./review-display";
export function ReviewForm({
  jobId,
  onSaved,
  onConflict,
}: {
  jobId: string;
  onSaved?: (review: Review) => void;
  onConflict?: () => Promise<void>;
}) {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [validation, setValidation] = useState("");
  const [recovering, setRecovering] = useState(false);
  const submit = useDataCommand("submitReview");
  const pending = submit.isPending || recovering;
  if (submit.isSuccess) return <ReviewDisplay review={submit.data} />;
  return (
    <form
      className="form-stack surface-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending) return;
        setValidation("");
        if (body.trim().length < 5) {
          setValidation(
            "Describe your experience in at least five characters.",
          );
          return;
        }
        try {
          const saved = await submit.mutateAsync({
            jobId,
            rating,
            body: body.trim(),
          });
          onSaved?.(saved);
        } catch (error) {
          if (errorCode(error) === "REVIEW_EXISTS" && onConflict) {
            setRecovering(true);
            try {
              await onConflict();
            } finally {
              setRecovering(false);
            }
          }
        }
      }}
    >
      <h2>Review the completed work</h2>
      <p>Your review is linked to this job. One review is allowed per job.</p>
      <fieldset className="rating-buttons" disabled={pending}>
        <legend>Rating</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            className={n <= rating ? "selected" : ""}
            onClick={() => setRating(n)}
            key={n}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            aria-pressed={n === rating}
          >
            ★
          </button>
        ))}
      </fieldset>
      <p className="rating-caption">{rating} out of 5</p>
      <label className="field">
        Describe your experience
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={6}
          minLength={5}
          maxLength={10000}
          disabled={pending}
        />
      </label>
      {validation && <p role="alert">{validation}</p>}
      {submit.isError && <p role="alert">{errorMessage(submit.error)}</p>}
      {submit.isError && (
        <p>If confirmation was lost, reload the review before trying again.</p>
      )}
      <Button type="submit" disabled={pending}>
        {recovering
          ? "Loading existing review…"
          : submit.isPending
            ? "Submitting…"
            : "Submit review"}
      </Button>
    </form>
  );
}
