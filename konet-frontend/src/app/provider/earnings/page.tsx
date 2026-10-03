import { EarningsWorkspace } from "@/features/payments/components/earnings-workspace";
export const metadata = { title: "Provider earnings" };
export default function Page() {
  return (
    <section className="provider-page earnings-page">
      <div className="page-heading provider-heading">
        <div>
          <span className="eyebrow">Payments</span>
          <h1>Earnings</h1>
          <p>
            Track completed earnings, queued payouts and confirmed transfers.
          </p>
        </div>
      </div>
      <EarningsWorkspace />
    </section>
  );
}
