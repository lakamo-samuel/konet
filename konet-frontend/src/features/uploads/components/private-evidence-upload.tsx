"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { command, errorMessage } from "@/data/access/client";
import { uploadPrivateFile } from "@/lib/uploads/private-file";
import type { PrivateUpload } from "@/types/verification";

type Props = {
  onReady: (upload: PrivateUpload | null) => void;
  disabled?: boolean;
  purpose?: "student_evidence" | "provider_evidence";
  label?: string;
};
export function PrivateEvidenceUpload({
  onReady,
  disabled,
  purpose = "student_evidence",
  label = "Student document",
}: Props) {
  const [upload, setUpload] = useState<PrivateUpload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const [confirming, setConfirming] = useState(false);
  const displayedUpload = upload;
  const confirmUpload = async (id: string) => {
    setConfirming(true);
    setError("");
    try {
      const confirmed = await command("completeUpload", { id });
      setUpload(confirmed);
      onReady(confirmed.status === "ready" ? confirmed : null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setConfirming(false);
    }
  };
  const discard = async () => {
    if (!upload) return;
    setBusy(true);
    setError("");
    try {
      await command("deleteUpload", { id: upload.id });
      setUpload(null);
      onReady(null);
      if (input.current) input.current.value = "";
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="form-stack">
      <label className="field">
        {label}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          disabled={disabled || busy || !!upload}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError("");
            onReady(null);
            const abort = new AbortController();
            controller.current = abort;
            try {
              const result = await uploadPrivateFile(
                file,
                purpose,
                abort.signal,
                setUpload,
              );
              setUpload(result);
              await confirmUpload(result.id);
            } catch (cause) {
              if (!abort.signal.aborted) setError(errorMessage(cause));
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <p>
        JPEG, PNG or PDF, up to 10 MiB. Your document stays private and is
        checked for file type and size before submission.
      </p>
      {busy && <p role="status">Uploading your document…</p>}
      {displayedUpload?.status === "ready" && (
        <p role="status">Document uploaded and ready to submit.</p>
      )}
      {displayedUpload?.status === "rejected" && (
        <p role="alert">
          The document does not match the accepted file type or size. Remove it
          and choose another file.
        </p>
      )}
      {upload && ["pending", "scanning"].includes(upload.status) && (
        <p role="status">Confirm the uploaded document to continue.</p>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {upload && !disabled && (
        <div className="inline-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={busy || confirming}
            onClick={discard}
          >
            Remove document
          </Button>
          {upload && ["pending", "scanning"].includes(upload.status) && (
            <Button
              type="button"
              disabled={busy || confirming}
              onClick={() => void confirmUpload(upload.id)}
            >
              Confirm upload
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
