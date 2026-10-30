export type TimestampValue = string | number | Date | null | undefined;

const relativeFormatter = new Intl.RelativeTimeFormat("it-IT", { numeric: "always" });
const absoluteFormatter = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "short", timeStyle: "short",
});
const daySeconds = 86400;

export function formatTimestamp(value: TimestampValue, now = Date.now()): string {
  if (value == null || value === "") return "N/D";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "N/D";
  const seconds = (date.getTime() - now) / 1000;
  const distance = Math.abs(seconds);
  if (distance >= 30 * daySeconds) return absoluteFormatter.format(date);
  if (distance < 60) return "ora";
  const [unit, divisor]: [Intl.RelativeTimeFormatUnit, number] = distance < 3600
    ? ["minute", 60] : distance < daySeconds ? ["hour", 3600] : ["day", daySeconds];
  const amount = Math.sign(seconds) * Math.floor(distance / divisor);
  return relativeFormatter.format(amount, unit);
}