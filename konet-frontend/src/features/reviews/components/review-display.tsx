import { formatDateTime } from "@/lib/formatters/date";
import type { Review } from "@/types/domain";
export function ReviewDisplay({ review }: { review: Review }) {
  return (
    <article className="surface-panel form-stack">
      <h2>Recorded job review</h2>
      <p aria-label={`Rating: ${review.rating} out of 5 stars`}>
        {review.rating} out of 5 stars
      </p>
      <p className="whitespace-pre-wrap break-words">{review.body}</p>
      <time dateTime={review.createdAt}>
        {formatDateTime(review.createdAt)}
      </time>
      <p>Feedback from the client of this completed job.</p>
    </article>
  );
}
