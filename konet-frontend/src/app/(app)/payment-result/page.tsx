import { PaymentPanel } from "@/features/payments/components/payment-panel";
import { Button } from "@/components/ui/button";
export const metadata = { title: "Payment result" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    jobId?: string | string[];
    reference?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const id =
    typeof params.jobId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      params.jobId,
    )
      ? params.jobId
      : undefined;
  const reference =
    typeof params.reference === "string" ? params.reference : undefined;
  return (
    <section className="workspace-page narrow">
      <div className="page-heading">
        <span className="eyebrow">Payment</span>
        <h1>Check your payment.</h1>
        <p>Konet confirms the transaction with the payment provider.</p>
      </div>
      {id ? (
        <>
          <PaymentPanel key={id} jobId={id} reference={reference} autoVerify />
          <Button href={`/jobs/${id}`} variant="secondary">
            Open job
          </Button>
        </>
      ) : (
        <p>
          Open the job you paid for and select Verify payment to check its
          status.
        </p>
      )}
      <Button href="/jobs" variant="secondary">
        View my jobs
      </Button>
    </section>
  );
}
