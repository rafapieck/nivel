/**
 * Parses a number typed by a person in Mexico. Commas are thousands separators
 * ("1,100" → 1100, "1,200.50" → 1200.5); a lone comma with no thousands grouping is
 * read as a decimal mark ("12,5" → 12.5). Spaces and a leading "$" are ignored.
 * Anything ambiguous ("1.200,50") or non-numeric returns NaN so the form can say so.
 */
export function parseNumberMx(raw: string): number {
  const s = raw.replace(/\s/g, "").replace(/^\$/, "");
  if (!/^-?(\d|[.,]\d)[\d.,]*$/.test(s)) return NaN;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ""));
  if (/^-?\d+,\d+$/.test(s) && !/^-?\d{1,3},\d{3}$/.test(s)) return Number(s.replace(",", "."));
  if (s.includes(",")) return NaN;
  return Number(s);
}
