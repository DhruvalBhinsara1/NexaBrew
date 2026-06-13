import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { getRazorpayClient } from "@/lib/razorpay";
import { OrderService } from "@/services/OrderService";
import { AppError } from "@/lib/utils/app-error";

type Ctx = { params: { id: string } };

/**
 * POST /api/orders/:id/razorpay
 * Creates a Razorpay order for the given NexaBrew order (must be payment_pending).
 * Returns the Razorpay order_id + publishable key so the client can open the checkout.
 */
export const POST = withAuth<Ctx>(async (_req, _user, { params }) => {
  const supabase = createServerClient();
  const order = await OrderService.getById(supabase, params.id);

  if (order.status !== "payment_pending") {
    throw new AppError("Order is not ready for payment", "ORDER_NOT_READY_FOR_PAYMENT", 409);
  }

  const razorpay = getRazorpayClient();
  const amountPaise = Math.round(Number(order.total_amount) * 100);

  const rzpOrder = await razorpay.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: order.order_number,
    notes: { nexabrew_order_id: order.id },
  });

  return NextResponse.json({
    data: {
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
      order_number: order.order_number,
      customer_email: order.customer?.email ?? null,
      customer_name: order.customer?.name ?? null,
    },
  });
});
