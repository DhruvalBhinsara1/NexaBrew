import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateOrderInput } from "@/schemas/order.schema";
import { calculateTotals, type LineInput } from "@/lib/utils/calculateTotals";
import { AppError } from "@/lib/utils/app-error";
import type { Coupon, OrderItem, Promotion } from "@/types/domain.types";
import type { Database } from "@/types/database.types";
import { DiscountService, netAmount, type DiscountableItem } from "@/services/DiscountService";

type Supa = SupabaseClient<Database>;
type OrderItemInput = CreateOrderInput["items"][number];
type ProductSnapshot = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  "id" | "name" | "price" | "tax_rate" | "is_active"
>;

export type DiscountState = {
  items: DiscountableItem[];
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  coupon_id: string | null;
  promotion_id: string | null;
  coupon: Coupon | null;
  promotion: Promotion | null;
  order_discount: number;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function normalizeItems(items: OrderItemInput[]): OrderItemInput[] {
  const quantities = new Map<string, number>();
  for (const item of items) {
    quantities.set(item.product_id, (quantities.get(item.product_id) ?? 0) + item.quantity);
  }
  return Array.from(quantities, ([product_id, quantity]) => ({ product_id, quantity }));
}

function totalsForDiscount(items: DiscountableItem[], orderDiscount: number) {
  const lines: LineInput[] = items.map((item) => ({
    unitPrice: Number(item.unit_price),
    quantity: item.quantity,
    taxRate: Number(item.tax_rate),
    discountAmount: Number(item.discount_amount),
  }));
  return calculateTotals({ items: lines, orderDiscount });
}

export function mapDatabaseError(error: { message: string; code?: string }, fallbackCode: string): AppError {
  if (error.code === "23505") {
    return new AppError("Duplicate record", "DUPLICATE_RECORD", 409);
  }
  if (error.code === "23503") {
    return new AppError("Referenced record not found", "REFERENCE_NOT_FOUND", 404);
  }
  return new AppError(error.message, fallbackCode, 400);
}

export async function snapshotItems(supabase: Supa, items: OrderItemInput[]): Promise<DiscountableItem[]> {
  const normalized = normalizeItems(items);
  if (normalized.length === 0) return [];

  const productIds = normalized.map((item) => item.product_id);
  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, tax_rate, is_active")
    .in("id", productIds);
  if (error) throw new AppError(error.message, "PRODUCTS_FETCH_FAILED", 500);

  const products = new Map((data ?? []).map((product) => [product.id, product as ProductSnapshot]));
  return normalized.map((item) => {
    const product = products.get(item.product_id);
    if (!product || !product.is_active) {
      throw new AppError("Product is unavailable", "PRODUCT_UNAVAILABLE", 400);
    }

    const discountAmount = 0;
    const base = Number(product.price) * item.quantity;
    return {
      product_id: product.id,
      product_name: product.name,
      unit_price: Number(product.price),
      tax_rate: Number(product.tax_rate),
      quantity: item.quantity,
      discount_amount: discountAmount,
      line_total: round2(base - discountAmount),
      promotion_id: null,
    };
  });
}

export async function freeTable(supabase: Supa, tableId: string | null): Promise<void> {
  if (!tableId) return;
  const { error } = await supabase
    .from("tables")
    .update({ status: "available" })
    .eq("id", tableId);
  if (error) throw new AppError(error.message, "TABLE_UPDATE_FAILED", 400);
}

export function orderItemsToDiscountableItems(items: OrderItem[]): DiscountableItem[] {
  return items.map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    unit_price: Number(item.unit_price),
    tax_rate: Number(item.tax_rate),
    quantity: item.quantity,
    discount_amount: Number(item.discount_amount),
    line_total: Number(item.line_total),
    promotion_id: item.promotion_id,
  }));
}

export async function buildDiscountState(
  supabase: Supa,
  items: DiscountableItem[],
  couponCode?: string | null
): Promise<DiscountState> {
  const promotedItems = await DiscountService.evaluateProductPromotions(supabase, items);
  const baseForOrderDiscount = netAmount(promotedItems);

  if (couponCode) {
    const couponDiscount = await DiscountService.validateCoupon(supabase, couponCode, baseForOrderDiscount);
    const totals = totalsForDiscount(promotedItems, couponDiscount.discountAmount);
    return {
      items: promotedItems,
      subtotal: totals.subtotal,
      discount_amount: totals.discountAmount,
      tax_amount: totals.taxAmount,
      total_amount: totals.totalAmount,
      coupon_id: couponDiscount.coupon.id,
      promotion_id: null,
      coupon: couponDiscount.coupon,
      promotion: null,
      order_discount: totals.orderDiscount,
    };
  }

  const orderPromotion = await DiscountService.evaluateOrderPromotion(supabase, baseForOrderDiscount);
  const totals = totalsForDiscount(promotedItems, orderPromotion.discountAmount);
  return {
    items: promotedItems,
    subtotal: totals.subtotal,
    discount_amount: totals.discountAmount,
    tax_amount: totals.taxAmount,
    total_amount: totals.totalAmount,
    coupon_id: null,
    promotion_id: orderPromotion.promotion?.id ?? null,
    coupon: null,
    promotion: orderPromotion.promotion,
    order_discount: totals.orderDiscount,
  };
}
