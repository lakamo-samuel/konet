export function ngnToMinor(
  value: string,
  optional = false,
): number | undefined {
  if (!value.trim() && optional) return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Enter an NGN amount with up to two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount > 2147483647)
    throw new Error("The amount is too large.");
  return amount;
}
export function futureDate(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now())
    throw new Error("Choose a future date and time.");
  return date.toISOString();
}
