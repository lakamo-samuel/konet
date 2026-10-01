"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/data/access/client";
import { useDataCommand } from "@/lib/query/hooks";
export function ReviewForm({ jobId }: { jobId: string }) {
  const [done, setDone] = useState(false);
  const [rating, setRating] = useState(5);
  const submit = useDataCommand("submitReview");
  if (done) return <div className="success-state"><h2>Review published</h2><p>Your feedback helps students hire with confidence.</p><Button href="/jobs">Back to jobs</Button></div>;
  return <form className="form-stack" onSubmit={async event => { event.preventDefault(); const values = new FormData(event.currentTarget); try { await submit.mutateAsync({ jobId, rating, body: String(values.get("body") ?? "").trim() }); setDone(true); } catch { /* Error is shown below. */ } }}>
    <fieldset className="rating-buttons"><legend className="sr-only">Rating</legend>{[1, 2, 3, 4, 5].map(number => <button type="button" className={number <= rating ? "selected" : ""} onClick={() => setRating(number)} key={number} aria-label={`${number} stars`} aria-pressed={number === rating}>★</button>)}</fieldset>
    <p className="rating-caption">{rating} out of 5</p><label className="field">Describe your experience<textarea name="body" required rows={6} minLength={20} /></label>
    {submit.isError && <p className="field-error" role="alert">{errorMessage(submit.error)}</p>}
    <Button type="submit" disabled={submit.isPending}>{submit.isPending ? "Publishing…" : "Publish verified review"}</Button>
  </form>;
}
