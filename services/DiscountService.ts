import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Coupon, DiscountType, Promotion } from "@/types/domain.types";
import type {
  CreateCouponInput,
  CreatePromotionInput,
  UpdateCouponInput,
  UpdatePromotionInput,
} from "@/schemas/coupon.schema";
import { AppError } from "@/lib/utils/app-error";

type Supa = SupabaseClient<Database>;

export interface DiscountableItem {
  product_id: string;
  product_name: string;
  unit_price: number;
  tax_rate: number;
  quantity: number;
  discount_amount: number;
  line_total: number;
  promotion_id: string | null;
}

export interface CouponDiscount {
  coupon: Coupon;
  discountAmount: number;
}

export interface OrderPromotionDiscount {
  promotion: Promotion | null;
  discountAmount: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function discountAmount(type: DiscountType | string, value: number, base: number): number {
  if (base <= 0) return 0;
  const raw = type === "percentage" ? base * (value / 100) : value;
  return round2(Math.min(Math.max(raw, 0), base));
}

function itemBase(item: Pick<DiscountableItem, "unit_price" | "quantity">): number {
  return Number(item.unit_price) * item.quantity;
}

export function netAmount(items: Pick<DiscountableItem, "unit_price" | "quantity" | "discount_amount">[]): number {
  return round2(
    items.reduce((sum, item) => sum + item.unit_price * item.quantity - item.discount_amount, 0)
  );
}

function mapDuplicate(error: { message: string; code?: string }, duplicateMessage: string, code: string): AppError {
  if (error.code === "23505") return new AppError(duplicateMessage, code, 409);
  if (error.code === "23503") return new AppError("Referenced record not found", "REFERENCE_NOT_FOUND", 404);
  return new AppError(error.message, code.replace("_DUPLICATE", "_FAILED"), 400);
}

export const DiscountService = {
  async listCoupons(supabase: Supa, isActive?: boolean): Promise<Coupon[]> {
    let query = supabase.from("coupons").select("*").order("created_at", { ascending: false });
    if (typeof isActive === "boolean") query = query.eq("is_active", isActive);
    const { data, error } = await query;
    if (error) throw new AppError(error.message, "COUPONS_LIST_FAILED", 500);
    return data ?? [];
  },

  async createCoupon(supabase: Supa, input: CreateCouponInput): Promise<Coupon> {
    const { data, error } = await supabase
      .from("coupons")
      .insert({
        code: input.code,
        discount_type: input.discount_type,
        discount_value: input.discount_value,
        is_active: input.is_active,
        max_uses: input.max_uses ?? null,
        expires_at: input.expires_at ?? null,
      })
      .select("*")
      .single();
    if (error) throw mapDuplicate(error, "Coupon code already exists", "COUPON_DUPLICATE");
    return data;
  },

  async updateCoupon(supabase: Supa, id: string, input: UpdateCouponInput): Promise<Coupon> {
    const { data, error } = await supabase
      .from("coupons")
      .update(input)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw mapDuplicate(error, "Coupon code already exists", "COUPON_DUPLICATE");
    if (!data) throw new AppError("Coupon not found", "COUPON_NOT_FOUND", 404);
    return data;
  },

  async removeCoupon(supabase: Supa, id: string): Promise<void> {
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) throw new AppError(error.message, "COUPON_DELETE_FAILED", 400);
  },

  async listPromotions(supabase: Supa, isActive?: boolean): Promise<Array<Promotion & { product: { id: string; name: string } | null }>> {
    let query = supabase
      .from("promotions")
      .select("*, product:products(id, name)")
      .order("created_at", { ascending: false });
    if (typeof isActive === "boolean") query = query.eq("is_active", isActive);
    const { data, error } = await query;
    if (error) throw new AppError(error.message, "PROMOTIONS_LIST_FAILED", 500);
    return (data ?? []) as Array<Promotion & { product: { id: string; name: string } | null }>;
  },

  async createPromotion(supabase: Supa, input: CreatePromotionInput): Promise<Promotion> {
    const row: Database["public"]["Tables"]["promotions"]["Insert"] =
      input.applies_to === "product"
        ? {
            name: input.name,
            applies_to: input.applies_to,
            product_id: input.product_id,
            min_quantity: input.min_quantity,
            min_order_amount: null,
            discount_type: input.discount_type,
            discount_value: input.discount_value,
            is_active: input.is_active,
          }
        : {
            name: input.name,
            applies_to: input.applies_to,
            product_id: null,
            min_quantity: null,
            min_order_amount: input.min_order_amount,
            discount_type: input.discount_type,
            discount_value: input.discount_value,
            is_active: input.is_active,
          };

    const { data, error } = await supabase.from("promotions").insert(row).select("*").single();
    if (error) throw mapDuplicate(error, "Promotion already exists", "PROMOTION_DUPLICATE");
    return data;
  },

  async updatePromotion(supabase: Supa, id: string, input: UpdatePromotionInput): Promise<Promotion> {
    const normalized: Database["public"]["Tables"]["promotions"]["Update"] = { ...input };
    if (input.applies_to === "product") normalized.min_order_amount = null;
    if (input.applies_to === "order") {
      normalized.product_id = null;
      normalized.min_quantity = null;
    }

    const { data, error } = await supabase
      .from("promotions")
      .update(normalized)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw mapDuplicate(error, "Promotion already exists", "PROMOTION_DUPLICATE");
    if (!data) throw new AppError("Promotion not found", "PROMOTION_NOT_FOUND", 404);
    return data;
  },

  async removePromotion(supabase: Supa, id: string): Promise<void> {
    const { error } = await supabase.from("promotions").delete().eq("id", id);
    if (error) throw new AppError(error.message, "PROMOTION_DELETE_FAILED", 400);
  },

  async evaluateProductPromotions(supabase: Supa, items: DiscountableItem[]): Promise<DiscountableItem[]> {
    if (items.length === 0) return items;

    const productIds = Array.from(new Set(items.map((item) => item.product_id)));
    const { data, error } = await supabase
      .from("promotions")
      .select("*")
      .eq("is_active", true)
      .eq("applies_to", "product")
      .in("product_id", productIds);
    if (error) throw new AppError(error.message, "PROMOTIONS_FETCH_FAILED", 500);

    const promos = (data ?? []) as Promotion[];
    return items.map((item) => {
      const base = itemBase(item);
      const eligible = promos
        .filter((promo) => promo.product_id === item.product_id)
        .filter((promo) => item.quantity >= Number(promo.min_quantity ?? 0))
        .map((promo) => ({
          promo,
          amount: discountAmount(promo.discount_type, Number(promo.discount_value), base),
        }))
        .sort((a, b) => b.amount - a.amount);
      const best = eligible[0];
      const lineDiscount = best?.amount ?? 0;

      return {
        ...item,
        discount_amount: lineDiscount,
        line_total: round2(base - lineDiscount),
        promotion_id: best?.promo.id ?? null,
      };
    });
  },

  async evaluateOrderPromotion(supabase: Supa, amount: number): Promise<OrderPromotionDiscount> {
    if (amount <= 0) return { promotion: null, discountAmount: 0 };

    const { data, error } = await supabase
      .from("promotions")
      .select("*")
      .eq("is_active", true)
      .eq("applies_to", "order")
      .lte("min_order_amount", amount);
    if (error) throw new AppError(error.message, "PROMOTIONS_FETCH_FAILED", 500);

    const eligible = ((data ?? []) as Promotion[])
      .map((promotion) => ({
        promotion,
        discountAmount: discountAmount(
          promotion.discount_type,
          Number(promotion.discount_value),
          amount
        ),
      }))
      .sort((a, b) => b.discountAmount - a.discountAmount);

    return eligible[0] ?? { promotion: null, discountAmount: 0 };
  },

  async validateCoupon(supabase: Supa, code: string, amount: number): Promise<CouponDiscount> {
    const normalizedCode = code.trim().toUpperCase();
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", normalizedCode)
      .maybeSingle();
    if (error) throw new AppError(error.message, "COUPON_FETCH_FAILED", 500);
    if (!data) throw new AppError("Invalid coupon code", "COUPON_INVALID", 404);

    const coupon = data as Coupon;
    if (!coupon.is_active) throw new AppError("Coupon is inactive", "COUPON_INACTIVE", 400);
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
      throw new AppError("Coupon has expired", "COUPON_EXPIRED", 400);
    }
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      throw new AppError("Coupon usage limit reached", "COUPON_USAGE_LIMIT", 400);
    }

    return {
      coupon,
      discountAmount: discountAmount(coupon.discount_type, Number(coupon.discount_value), amount),
    };
  },
};
