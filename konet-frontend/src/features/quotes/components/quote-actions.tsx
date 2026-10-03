"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useDataCommand } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
export function QuoteActions({
  quoteId,
  available,
}: {
  quoteId: string;
  available: boolean;
}) {
  const router = useRouter();
  const accept = useDataCommand("acceptQuote");
  return (
    <div>
      <p>
        Acceptance creates a job awaiting payment. Work starts after payment is
        confirmed.
      </p>
      <Button
        disabled={!available || accept.isPending}
        onClick={async () => {
          try {
            const job = await accept.mutateAsync({ quoteId });
            router.push(`/jobs/${job.id}`);
          } catch {
            /* Error below. */
          }
        }}
      >
        {accept.isPending ? "Accepting…" : "Accept quote"}
      </Button>
      {accept.isError && <p role="alert">{errorMessage(accept.error)}</p>}
    </div>
  );
}
