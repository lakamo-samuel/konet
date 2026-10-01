import { notFound } from "next/navigation";
import { getRequestById } from "@/data/repositories/job.repository";
import { getCurrentUser } from "@/data/repositories/user.repository";
import { QuoteForm } from "@/features/quotes/components/quote-form";
import { formatNaira } from "@/lib/formatters/currency";
type Props = { params: Promise<{ requestId: string }> };
export const metadata = { title: "Respond to request" };
export default async function Page({ params }: Props) {
  const [request, user] = await Promise.all([getRequestById((await params).requestId), getCurrentUser()]);
  if (!request || request.providerId !== user.providerProfileId) notFound();
  return <section className="provider-page narrow"><div className="page-heading"><span className="eyebrow">Service request</span><h1>{request.service}</h1><p>{request.requestedDate} at {request.requestedTime} · {request.location}</p></div>
    <article className="surface-panel"><h2>Client brief</h2><p>{request.details}</p><p><strong>Budget:</strong> {formatNaira(request.budgetMin)}–{formatNaira(request.budgetMax)}</p></article>
    {request.status === "pending" ? <QuoteForm requestId={request.id} minimum={request.budgetMin} /> : <div className="surface-panel mt-5"><p className="text-[var(--muted)]">This request has already been {request.status}.</p></div>}
  </section>;
}
