import { notFound } from "next/navigation";
import { getQuoteById, getRequestById } from "@/data/repositories/job.repository";
import { getSession } from "@/lib/auth/session";
import { formatNaira } from "@/lib/formatters/currency";
import { QuoteActions } from "@/features/quotes/components/quote-actions";
type Props = { params: Promise<{ quoteId: string }> };
export const metadata = { title: "Review quote" };
export default async function Page({ params }: Props) {
  const quote = await getQuoteById((await params).quoteId);
  if (!quote) notFound();
  const [request, session] = await Promise.all([getRequestById(quote.requestId), getSession()]);
  if (!request || request.clientId !== session?.userId) notFound();
  const available = quote.status === "pending";
  return <section className="workspace-page narrow"><div className="page-heading"><span className="eyebrow">Quote received</span><h1>{request.service}</h1><p>Review the scope before accepting and protecting payment.</p></div><article className="surface-panel"><div className="quote-amount"><span>Total quote</span><strong>{formatNaira(quote.amount)}</strong></div><h2>Included</h2><div className="scope-list">{quote.scope.map(item => <span key={item}>✓ {item}</span>)}</div><h2>Provider note</h2><p>{quote.note || "No additional note."}</p><QuoteActions quoteId={quote.id} available={available} /></article></section>;
}
