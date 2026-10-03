"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataCommand, useDataQuery } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { paystackCheckoutUrl } from "@/lib/formatters/payment";
import { formatNaira } from "@/lib/formatters/currency";
import { PaymentPanel } from "@/features/payments/components/payment-panel";
export function CheckoutForm({ jobId }: { jobId: string }) {
  const job = useDataQuery("job", { id: jobId }, undefined, {
    refetchInterval: 10000,
  });
  const user = useDataQuery("currentUser", {});
  const checkout = useDataCommand("checkout");
  const [redirectError, setRedirectError] = useState("");
  async function pay() {
    setRedirectError("");
    try {
      const result = await checkout.mutateAsync({ jobId });
      window.location.assign(paystackCheckoutUrl(result.checkoutUrl));
    } catch (error) {
      setRedirectError(errorMessage(error));
    }
  }
  if (job.isPending || user.isPending)
    return <p role="status">Loading checkout…</p>;
  if (job.isError || user.isError)
    return <p role="alert">{errorMessage(job.error ?? user.error)}</p>;
  if (!job.data) return <p>Job unavailable.</p>;
  const j = job.data;
  return (
    <div className="form-stack">
      <p>
        Job {j.id.slice(0, 8)} · {formatNaira(j.agreedAmountMinor / 100)}
      </p>
      <PaymentPanel jobId={jobId} />
      {j.status === "awaiting_payment" && j.clientId === user.data.id && (
        <>
          <p>
            Continue to Paystack to pay. Konet confirms the result before
            scheduling the job.
          </p>
          <Button disabled={checkout.isPending} onClick={pay}>
            {checkout.isPending ? "Opening checkout…" : "Continue to Paystack"}
          </Button>
        </>
      )}
      {j.clientId !== user.data.id && (
        <p>Only the client can pay for this job.</p>
      )}
      {redirectError && <p role="alert">{redirectError}</p>}
      <Button href={`/jobs/${jobId}`} variant="secondary">
        Open job
      </Button>
    </div>
  );
}
