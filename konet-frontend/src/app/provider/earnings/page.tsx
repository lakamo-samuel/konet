import { EarningsWorkspace } from "@/features/payments/components/earnings-workspace";
import { PageHeader } from "@/components/ui/page-header";
export const metadata = { title: "Provider earnings" };
export default function Page() {
  return (
    <section className="provider-page earnings-page">
      <PageHeader
        eyebrow="Payments"
        title="Earnings"
        description="Track completed earnings, queued payouts and confirmed transfers."
      />
      <EarningsWorkspace />
    </section>
  );
}
