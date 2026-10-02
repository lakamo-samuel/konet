"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { command, errorMessage } from "@/data/access/client";
import { uploadPrivateFile } from "@/lib/uploads/private-file";
import type { PrivateUpload } from "@/types/verification";

type Props = {
  onReady: (upload: PrivateUpload | null) => void;
  disabled?: boolean;
};
export function PrivateEvidenceUpload({ onReady, disabled }: Props) {
  const [upload, setUpload] = useState<PrivateUpload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scanStarted, setScanStarted] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [transferred, setTransferred] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!scanStarted) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [scanStarted]);
  const timedOut = scanStarted > 0 && now - scanStarted > 10 * 60_000;
  const scan = useQuery({
    queryKey: ["konet", "uploadScan", upload?.id],
    queryFn: () => command("completeUpload", { id: upload!.id }),
    enabled:
      !!upload &&
      transferred &&
      !disabled &&
      !timedOut &&
      ["pending", "scanning"].includes(upload.status),
    retry: false,
    refetchInterval: (query) =>
      !query.state.error &&
      query.state.data?.status !== "ready" &&
      query.state.data?.status !== "rejected" &&
      !timedOut
        ? 3000
        : false,
  });
  useEffect(() => {
    if (!scan.data) return;
    onReady(scan.data.status === "ready" ? scan.data : null);
  }, [scan.data, onReady]);
  const displayedUpload = scan.data?.id === upload?.id ? scan.data : upload;
  const discard = async () => {
    if (!upload) return;
    setBusy(true);
    setError("");
    try {
      await command("deleteUpload", { id: upload.id });
      setUpload(null);
      setTransferred(false);
      setScanStarted(0);
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
        Student document
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
                "student_evidence",
                abort.signal,
                setUpload,
              );
              setUpload(result);
              setTransferred(true);
              const time = Date.now();
              setScanStarted(time);
              setNow(time);
            } catch (cause) {
              if (!abort.signal.aborted) setError(errorMessage(cause));
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <p>
        JPEG, PNG or PDF, up to 10 MiB. Your document is private and must pass a
        security scan before submission.
      </p>
      {busy && <p role="status">Uploading your document…</p>}
      {displayedUpload?.status === "ready" && (
        <p role="status">Document scanned and ready to submit.</p>
      )}
      {displayedUpload?.status === "rejected" && (
        <p role="alert">
          The document failed validation or its security scan. Remove it and
          choose another file.
        </p>
      )}
      {transferred &&
        upload &&
        ["pending", "scanning"].includes(displayedUpload!.status) && (
          <p role="status">
            {timedOut
              ? "The scan is taking longer than expected. Check again to continue."
              : "Checking the document security scan…"}
          </p>
        )}
      {(error || scan.isError) && (
        <p role="alert" className="field-error">
          {error || errorMessage(scan.error)}
        </p>
      )}
      {upload && !disabled && (
        <div className="inline-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={busy || scan.isFetching}
            onClick={discard}
          >
            Remove document
          </Button>
          {transferred && (timedOut || scan.isError) && (
            <Button
              type="button"
              disabled={busy || scan.isFetching}
              onClick={() => {
                const time = Date.now();
                setScanStarted(time);
                setNow(time);
                void scan.refetch();
              }}
            >
              Check scan again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
