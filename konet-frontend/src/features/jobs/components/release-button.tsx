"use client";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/data/access/client";
import { useDataCommand } from "@/lib/query/hooks";
export function ReleaseButton({ jobId, ready }: { jobId: string; ready: boolean }) {
  const release = useDataCommand("confirmCompletion");
  return <div><Button className="full-width" disabled={!ready || release.isPending} onClick={() => release.mutate({ jobId })}>{release.isPending ? "Releasing…" : "Approve and release"}</Button>{release.isError && <p role="alert" className="field-error mt-2">{errorMessage(release.error)}</p>}</div>;
}
