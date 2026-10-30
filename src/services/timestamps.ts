export type TimestampValue = string | number | Date | null | undefined;

const relativeFormatter = new Intl.RelativeTimeFormat("it-IT", { numeric: "always" });
const absoluteFormatter = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "short", timeStyle: "short",
});
const logFormatter = new Intl.DateTimeFormat("it-IT", {
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  fractionalSecondDigits: 3, hourCycle: "h23",
});
const daySeconds = 86400;

export function formatLogTimestamp(value: TimestampValue): string {
  if (value == null || value === "") return "N/D";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? logFormatter.format(date) : "N/D";
}

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