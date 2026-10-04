"use client";
import { formatDateTime } from "@/lib/formatters/date";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataCommand } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { PrivateEvidenceUpload } from "@/features/uploads/components/private-evidence-upload";
import { verificationLabels } from "@/features/verification/components/verification-history";
import { OnboardingState } from "./onboarding-state";
import type {
  ProviderDimension,
  ProviderVerification,
} from "@/types/provider-onboarding";
import type { PrivateUpload } from "@/types/verification";
const labels = { identity: "Identity", work: "Work evidence", cac: "CAC" };
export function EvidenceStep() {
  return (
    <OnboardingState>
      {(data) => (
        <div className="form-stack">
          <p>
            Identity and work evidence are required. CAC is optional. Documents
            are private and reviewed by an admin.
          </p>
          {[
            ...data.requirements.requiredDimensions,
            ...data.requirements.optionalDimensions,
          ].map((dimension) => (
            <EvidenceEditor
              key={dimension}
              dimension={dimension}
              record={data.verification.find((v) => v.dimension === dimension)}
              required={data.requirements.requiredDimensions.includes(
                dimension,
              )}
            />
          ))}
          <Button href="/provider/onboarding/preview" variant="secondary">
            Review your application
          </Button>
        </div>
      )}
    </OnboardingState>
  );
}
function EvidenceEditor({
  dimension,
  record,
  required,
}: {
  dimension: ProviderDimension;
  record?: ProviderVerification;
  required: boolean;
}) {
  const [ready, setReady] = useState<PrivateUpload | null>(null);
  const submit = useDataCommand("submitProviderEvidence");
  const complete =
    record?.status === "pending" || record?.status === "verified";
  return (
    <section className="surface-panel form-stack">
      <h3>
        {labels[dimension]} · {required ? "Required" : "Optional"}
      </h3>
      <p>Status: {verificationLabels[record?.status ?? "not_submitted"]}</p>
      {record?.reason && (
        <p>
          <strong>Review feedback:</strong> {record.reason}
        </p>
      )}
      {record?.submittedAt && (
        <p>
          Submitted {formatDateTime(record.submittedAt)} · Revision{" "}
          {record.revision}
        </p>
      )}
      {record?.status === "pending" && (
        <p role="status">Awaiting admin review.</p>
      )}
      {!complete && (
        <div className="form-stack">
          <PrivateEvidenceUpload
            purpose="provider_evidence"
            label={`${labels[dimension]} document`}
            onReady={setReady}
            disabled={submit.isPending}
          />
          <Button
            type="button"
            disabled={!ready || submit.isPending}
            onClick={async () => {
              if (!ready) return;
              try {
                await submit.mutateAsync({
                  dimension,
                  evidenceObjectKey: ready.objectKey,
                });
                setReady(null);
              } catch {
                /* Error below. */
              }
            }}
          >
            {submit.isPending ? "Submitting…" : "Submit evidence"}
          </Button>
        </div>
      )}
      {submit.isError && <p role="alert">{errorMessage(submit.error)}</p>}
    </section>
  );
}
