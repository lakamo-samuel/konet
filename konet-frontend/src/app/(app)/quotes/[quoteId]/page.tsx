import { QuoteWorkspace } from "@/features/hiring/components/quote-workspace";
export const metadata = { title: "Quote" };
export default async function Page({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  return (
    <section className="workspace-page narrow">
      <h1>Quote</h1>
      <QuoteWorkspace id={quoteId} />
    </section>
  );
}
