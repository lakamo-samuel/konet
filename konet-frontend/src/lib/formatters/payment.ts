import type { PaymentStatus } from "@/types/payments";
export const paymentLabel: Record<PaymentStatus, string> = {
  pending: "Awaiting payment",
  processing: "Payment confirmation pending",
  funded: "Payment received",
  held: "Payment recorded as held",
  release_pending: "Payout queued",
  released: "Payout confirmed",
  failed: "Payment unsuccessful",
  refunded: "Refund confirmed",
  disputed: "Payment disputed",
};
export function paystackCheckoutUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "checkout.paystack.com" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw new Error("The payment provider returned an invalid checkout link.");
  return url.toString();
}
