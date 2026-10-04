// Explicit locale and timezone keep server and browser output consistent.
const options = {
  timeZone: "Africa/Lagos",
  day: "numeric",
  month: "short",
  year: "numeric",
} as const;
const date = new Intl.DateTimeFormat("en-GB", options);
const dateTime = new Intl.DateTimeFormat("en-GB", {
  ...options,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const time = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
function format(formatter: Intl.DateTimeFormat, value: string | number | Date) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Date unavailable"
    : formatter.format(parsed);
}
export const formatDate = (value: string | number | Date) =>
  format(date, value);
export const formatDateTime = (value: string | number | Date) =>
  format(dateTime, value);
export const formatTime = (value: string | number | Date) =>
  format(time, value);
