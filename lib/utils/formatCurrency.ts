const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format a monetary amount as INR with a ₹ prefix and exactly 2 decimal places
 * (e.g. 1234.5 → "₹1,234.50"). Use for EVERY monetary value shown to users.
 * Falls back to ₹0.00 for non-finite input.
 */
export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return inrFormatter.format(0);
  return inrFormatter.format(amount);
}
