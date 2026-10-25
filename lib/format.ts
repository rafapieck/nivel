const intFmt = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
const dateTimeFmt = new Intl.DateTimeFormat("es-MX", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export const fmtInt = (n: number) => intFmt.format(n);
export const fmtDateTime = (ts: number) => dateTimeFmt.format(ts);

const oneDecimal = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });
const weekdayFmt = new Intl.DateTimeFormat("es-MX", { weekday: "short" });
const timeFmt = new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("es-MX", { hour: "numeric" });

export const fmtOneDecimal = (n: number) => oneDecimal.format(n);
export const fmtWeekday = (ts: number) => weekdayFmt.format(ts).replace(".", "");
export const fmtTime = (ts: number) => timeFmt.format(ts);
export const fmtHour = (ts: number) => hourFmt.format(ts);

/** "mar 2:10–4:40 p.m." style range (weekday of the start). */
export function fmtEventRange(start: number, end: number) {
  return `${fmtWeekday(start)} ${fmtTime(start)}–${fmtTime(end)}`;
}

/** "3–4" or "3.5–4" days. */
export const fmtDays = (r: { min: number; max: number }) =>
  `${fmtOneDecimal(r.min)}–${fmtOneDecimal(r.max)}`;

const dayMonthFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });
export const fmtDayMonth = (ts: number) => dayMonthFmt.format(ts).replace(".", "");

const mxnFmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
export const fmtMxn = (n: number) => mxnFmt.format(n);
