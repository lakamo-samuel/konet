import { formatDateTime } from "@/lib/formatters/date";
import type { StudentVerification } from "@/types/verification";
import { EmptyState } from "@/components/ui/empty-state";
export const verificationLabels: Record<string, string> = {
  unverified: "Not verified",
  not_submitted: "Not submitted",
  pending: "Awaiting review",
  verified: "Verified",
  rejected: "Rejected",
  requires_more_information: "More information required",
};
export const methodLabels = {
  university_email: "University email",
  student_id: "Student ID",
  manual_document: "Other student document",
};
export function VerificationHistory({
  records,
}: {
  records: StudentVerification[];
}) {
  return (
    <section className="form-stack" aria-label="Verification history">
      <h3>Verification history</h3>
      {!records.length && (
        <EmptyState
          icon="verified"
          className="verification-history-empty"
          title="No verification submitted"
          description="Your student verification submissions and review updates will appear here."
        />
      )}
      {records.map((record) => (
        <article key={record.id} className="surface-panel">
          <h4>
            {methodLabels[record.method]} ·{" "}
            {record.status === "pending" && record.method === "university_email"
              ? "Awaiting email confirmation"
              : (verificationLabels[record.status] ?? record.status)}
          </h4>
          <p>Submitted {formatDateTime(record.submittedAt)}</p>
          {record.decidedAt && (
            <p>Reviewed {formatDateTime(record.decidedAt)}</p>
          )}
          {record.reason && (
            <p>
              <strong>Review feedback:</strong> {record.reason}
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
