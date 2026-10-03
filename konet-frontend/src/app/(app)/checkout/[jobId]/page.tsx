import { CheckoutForm } from "@/features/payments/components/checkout-form";
export const metadata = { title: "Job payment" };
export default async function Page({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return (
    <section className="workspace-page narrow">
      <div className="page-heading">
        <span className="eyebrow">Payment</span>
        <h1>Pay for your job.</h1>
      </div>
      <CheckoutForm jobId={jobId} />
    </section>
  );
}
