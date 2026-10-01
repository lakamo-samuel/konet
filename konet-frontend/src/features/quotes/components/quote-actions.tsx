"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/data/access/client";
import { useDataCommand } from "@/lib/query/hooks";
export function QuoteActions({ quoteId, available }: { quoteId: string; available: boolean }) {
  const router = useRouter();
  const accept = useDataCommand("acceptQuote");
  return <div className="mt-6"><Button disabled={!available || accept.isPending} onClick={async () => { try { const job = await accept.mutateAsync({ quoteId }); router.push(`/checkout/${job.id}`); } catch { /* Error is shown below. */ } }}>{accept.isPending ? "Accepting…" : available ? "Accept quote" : "Quote unavailable"}</Button>{accept.isError && <p className="field-error mt-3" role="alert">{errorMessage(accept.error)}</p>}</div>;
}
