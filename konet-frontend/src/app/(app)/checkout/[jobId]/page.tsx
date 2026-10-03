import { notFound } from "next/navigation";
import { getJobById } from "@/data/repositories/job.repository";
import { CheckoutForm } from "@/features/escrow/components/checkout-form";
import { formatNaira } from "@/lib/formatters/currency";
type Props = { params: Promise<{ jobId: string }> };
export const metadata = { title: "Secure checkout" };
export default async function Page({ params }: Props) {
  const job = await getJobById((await params).jobId);
  if (!job) notFound();
  return (
    <section className="workspace-page narrow">
      <div className="page-heading">
        <span className="eyebrow">Protected checkout</span>
        <h1>Fund the job securely.</h1>
        <p>
          {`Job ${job.id.slice(0, 8)}`} ·{" "}
          {job.scheduledAt ?? "Date to be agreed"} ·{" "}
          {formatNaira(job.agreedAmountMinor / 100)}
        </p>
      </div>
      <div className="surface-panel">
        <CheckoutForm amount={job.agreedAmountMinor / 100} jobId={job.id} />
      </div>
    </section>
  );
}
