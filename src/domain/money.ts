/** ₹1,500 or ₹1,500.50 from integer paise, with Indian digit grouping. */
export function inr(paise: number): string {
  const r = paise / 100;
  return "₹" + r.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(r) ? 0 : 2, maximumFractionDigits: 2 });
}
/** Basis-point share of an amount, rounded to the nearest paisa. */
export function bpOf(paise: number, bp: number): number { return Math.round((paise * bp) / 10000); }
