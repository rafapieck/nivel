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
