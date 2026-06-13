/** A single cart line, after product-level promotion discounts are applied. */
export interface LineInput {
  unitPrice: number;
  quantity: number;
  taxRate: number; // percentage, e.g. 5 or 12
  discountAmount: number; // product-promotion discount on this line
}

export interface CalculateTotalsInput {
  items: LineInput[];
  /** Order-level discount from a coupon OR an order promotion (never both). */
  orderDiscount: number;
}

export interface OrderTotals {
  subtotal: number;
  productDiscounts: number;
  orderDiscount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function calculateTotals(input: CalculateTotalsInput): OrderTotals {
  const normalized = input.items.map((item) => {
    const base = item.unitPrice * item.quantity;
    const discount = clamp(item.discountAmount, 0, base);
    return {
      base,
      net: base - discount,
      taxRate: item.taxRate,
      discount,
    };
  });

  const subtotal = normalized.reduce((sum, item) => sum + item.base, 0);
  const productDiscounts = normalized.reduce((sum, item) => sum + item.discount, 0);
  const netSum = normalized.reduce((sum, item) => sum + item.net, 0);
  const orderDiscount = clamp(input.orderDiscount, 0, netSum);

  const taxAmount = normalized.reduce((sum, item) => {
    const share = netSum > 0 ? orderDiscount * (item.net / netSum) : 0;
    const taxable = Math.max(item.net - share, 0);
    return sum + taxable * (item.taxRate / 100);
  }, 0);

  const discountAmount = productDiscounts + orderDiscount;
  const totalAmount = subtotal - discountAmount + taxAmount;

  return {
    subtotal: round2(subtotal),
    productDiscounts: round2(productDiscounts),
    orderDiscount: round2(orderDiscount),
    discountAmount: round2(discountAmount),
    taxAmount: round2(taxAmount),
    totalAmount: round2(totalAmount),
  };
}
