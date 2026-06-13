import QRCode from "qrcode";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  OrderReceipt,
  OrderWithItems,
  Payment,
  PaymentMethodType,
  PaymentResult,
  UpiQrPayload,
} from "@/types/domain.types";
import type { ProcessPaymentInput } from "@/schemas/payment.schema";
import { AppError } from "@/lib/utils/app-error";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { ORDER_SELECT, OrderService } from "@/services/OrderService";
import { freeTable, mapDatabaseError } from "@/services/OrderPricing";
import { formatCurrency } from "@/lib/utils/formatCurrency";

type Supa = SupabaseClient<Database>;

const RECEIPT_SELECT = `${ORDER_SELECT}, payment:payments(*)`;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function normalizeMoney(n: number): number {
  return round2(Number(n));
}


function emailConfigured(): boolean {
  const key = process.env.RESEND_API_KEY;
  return Boolean(key && key.trim() && !key.includes("placeholder"));
}

function buildReceipt(order: OrderWithItems & { payment: Payment | null }): OrderReceipt {
  if (!order.payment) {
    throw new AppError("Payment not found for this order", "PAYMENT_NOT_FOUND", 404);
  }

  return {
    order_id: order.id,
    order_number: order.order_number,
    status: order.status,
    paid_at: order.payment.paid_at,
    session_id: order.session_id,
    table: order.table,
    customer: order.customer,
    employee: order.employee,
    items: order.items,
    subtotal: Number(order.subtotal),
    discount_amount: Number(order.discount_amount),
    tax_amount: Number(order.tax_amount),
    total_amount: Number(order.total_amount),
    payment: order.payment,
  };
}

function receiptText(receipt: OrderReceipt): string {
  const lines = [
    "NexaBrew Receipt",
    `Order: ${receipt.order_number}`,
    `Paid at: ${receipt.paid_at ?? ""}`,
  ];

  if (receipt.customer?.name) {
    lines.push(`Customer: ${receipt.customer.name}`);
  }

  lines.push(
    "",
    ...receipt.items.map(
      (item) =>
        `${item.product_name} x${item.quantity} - ${formatCurrency(Number(item.line_total))}`
    ),
    "",
    `Subtotal: ${formatCurrency(receipt.subtotal)}`,
    `Discount: ${formatCurrency(receipt.discount_amount)}`,
    `Tax: ${formatCurrency(receipt.tax_amount)}`,
    `Total: ${formatCurrency(receipt.total_amount)}`,
    `Payment: ${receipt.payment.payment_method_type.toUpperCase()}`
  );

  if (receipt.payment.transaction_reference) {
    lines.push(`Reference: ${receipt.payment.transaction_reference}`);
  }

  return lines.join("\n");
}

function receiptHtml(receipt: OrderReceipt): string {
  const rows = receipt.items
    .map(
      (item) => `
        <tr>
          <td>${item.product_name}</td>
          <td style="text-align:center">${item.quantity}</td>
          <td style="text-align:right">${formatCurrency(Number(item.line_total))}</td>
        </tr>`
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#18181b;max-width:560px;margin:0 auto">
      <h1 style="margin:0 0 8px">NexaBrew Receipt</h1>
      <p style="margin:0 0 4px;color:#52525b">Order ${receipt.order_number}</p>
      ${
        receipt.customer?.name
          ? `<p style="margin:0 0 24px;color:#52525b">Customer: <strong>${receipt.customer.name}</strong></p>`
          : `<div style="margin-bottom:24px;"></div>`
      }
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead>
          <tr>
            <th style="text-align:left;border-bottom:1px solid #e4e4e7;padding:8px 0">Item</th>
            <th style="text-align:center;border-bottom:1px solid #e4e4e7;padding:8px 0">Qty</th>
            <th style="text-align:right;border-bottom:1px solid #e4e4e7;padding:8px 0">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p>Subtotal: <strong>${formatCurrency(receipt.subtotal)}</strong></p>
      <p>Discount: <strong>${formatCurrency(receipt.discount_amount)}</strong></p>
      <p>Tax: <strong>${formatCurrency(receipt.tax_amount)}</strong></p>
      <p style="font-size:20px">Total: <strong>${formatCurrency(receipt.total_amount)}</strong></p>
      <p style="color:#52525b">Payment: ${receipt.payment.payment_method_type.toUpperCase()}</p>
    </div>`;
}

async function loadReceiptOrder(
  supabase: Supa,
  orderId: string
): Promise<OrderWithItems & { payment: Payment | null }> {
  const { data, error } = await supabase
    .from("orders")
    .select(RECEIPT_SELECT)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new AppError(error.message, "RECEIPT_FETCH_FAILED", 500);
  if (!data) throw new AppError("Order not found", "ORDER_NOT_FOUND", 404);
  return data as OrderWithItems & { payment: Payment | null };
}

export const PaymentService = {
  async process(supabase: Supa, orderId: string, input: ProcessPaymentInput): Promise<PaymentResult> {
    const order = await OrderService.getById(supabase, orderId);
    if (order.status === "paid") {
      throw new AppError("Order is already paid", "ORDER_ALREADY_PAID", 409);
    }
    if (order.status !== "payment_pending") {
      throw new AppError("Order is not ready for payment", "ORDER_NOT_READY_FOR_PAYMENT", 409);
    }

    const amountPaid = normalizeMoney(Number(order.total_amount));
    let amountTendered: number | null = null;
    let changeDue: number | null = null;
    let transactionReference: string | null = null;

    if (input.payment_method_type === "cash") {
      // Validate cash payment method is enabled
      const { data: method, error: methodError } = await supabase
        .from("payment_methods")
        .select("is_enabled")
        .eq("type", "cash")
        .maybeSingle();
      if (methodError) throw new AppError(methodError.message, "PAYMENT_METHOD_FETCH_FAILED", 500);
      if (!method?.is_enabled) throw new AppError("Cash payments are disabled", "PAYMENT_METHOD_DISABLED", 400);

      amountTendered = normalizeMoney(input.amount_tendered);
      if (amountTendered < amountPaid) {
        throw new AppError("Cash tendered is less than the order total", "INSUFFICIENT_CASH", 400);
      }
      changeDue = normalizeMoney(amountTendered - amountPaid);
    } else if (input.payment_method_type === "razorpay") {
      // Verify Razorpay HMAC-SHA256 signature — rejects tampered responses
      const valid = verifyRazorpaySignature(
        input.razorpay_order_id,
        input.razorpay_payment_id,
        input.razorpay_signature
      );
      if (!valid) {
        throw new AppError("Razorpay signature verification failed", "RAZORPAY_SIGNATURE_INVALID", 400);
      }
      transactionReference = input.razorpay_payment_id;
    } else {
      throw new AppError("Unsupported payment method", "PAYMENT_METHOD_UNSUPPORTED", 400);
    }

    const paymentInsert: Database["public"]["Tables"]["payments"]["Insert"] = {
      order_id: order.id,
      payment_method_type: input.payment_method_type,
      amount_paid: amountPaid,
      amount_tendered: amountTendered,
      change_due: changeDue,
      transaction_reference: transactionReference,
      status: "completed",
      paid_at: new Date().toISOString(),
    };

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert(paymentInsert)
      .select("*")
      .single();
    if (paymentError) throw mapDatabaseError(paymentError, "PAYMENT_CREATE_FAILED");

    const { data: paidOrder, error: orderError } = await supabase
      .from("orders")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("status", "payment_pending")
      .select("id")
      .maybeSingle();
    if (orderError || !paidOrder) {
      await supabase.from("payments").delete().eq("id", payment.id);
      if (orderError) throw new AppError(orderError.message, "ORDER_PAYMENT_FAILED", 400);
      throw new AppError("Order is not ready for payment", "ORDER_NOT_READY_FOR_PAYMENT", 409);
    }

    await freeTable(supabase, order.table_id);

    if (order.coupon_id) {
      const { data: coupon, error: couponError } = await supabase
        .from("coupons")
        .select("used_count")
        .eq("id", order.coupon_id)
        .maybeSingle();
      if (couponError) throw new AppError(couponError.message, "COUPON_UPDATE_FAILED", 400);
      if (coupon) {
        const { error: couponUpdateError } = await supabase
          .from("coupons")
          .update({ used_count: coupon.used_count + 1 })
          .eq("id", order.coupon_id);
        if (couponUpdateError) {
          throw new AppError(couponUpdateError.message, "COUPON_UPDATE_FAILED", 400);
        }
      }
    }

    const receipt = await this.getReceipt(supabase, order.id);
    return { payment, order: await OrderService.getById(supabase, order.id), receipt };
  },

  async getReceipt(supabase: Supa, orderId: string): Promise<OrderReceipt> {
    const order = await loadReceiptOrder(supabase, orderId);
    if (order.status !== "paid") {
      throw new AppError("Receipt is available after payment", "RECEIPT_NOT_READY", 409);
    }
    return buildReceipt(order);
  },

  async sendReceipt(
    supabase: Supa,
    orderId: string,
    email?: string
  ): Promise<{ receipt: OrderReceipt; email: string; id: string | null }> {
    const receipt = await this.getReceipt(supabase, orderId);
    const to = email ?? receipt.customer?.email;
    if (!to) throw new AppError("Receipt email is required", "RECEIPT_EMAIL_REQUIRED", 400);
    if (!emailConfigured()) {
      throw new AppError("Receipt email is not configured", "RECEIPT_EMAIL_NOT_CONFIGURED", 501);
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: "NexaBrew <onboarding@resend.dev>",
      to,
      subject: `NexaBrew receipt ${receipt.order_number}`,
      text: receiptText(receipt),
      html: receiptHtml(receipt),
    });
    if (error) {
      throw new AppError(error.message, "RECEIPT_EMAIL_FAILED", 502);
    }

    return { receipt, email: to, id: data?.id ?? null };
  },

  async generateUpiQr(supabase: Supa, orderId: string): Promise<UpiQrPayload> {
    const order = await OrderService.getById(supabase, orderId);
    if (order.status !== "payment_pending") {
      throw new AppError("UPI QR is available only for payment-pending orders", "ORDER_NOT_READY_FOR_PAYMENT", 409);
    }

    const { data: method, error } = await supabase
      .from("payment_methods")
      .select("type, is_enabled, upi_id")
      .eq("type", "upi")
      .maybeSingle();
    if (error) throw new AppError(error.message, "PAYMENT_METHOD_FETCH_FAILED", 500);
    if (!method || !method.is_enabled) {
      throw new AppError("UPI payments are disabled", "PAYMENT_METHOD_DISABLED", 400);
    }
    if (!method.upi_id) throw new AppError("UPI ID is required", "UPI_ID_REQUIRED", 400);

    const amount = normalizeMoney(Number(order.total_amount));
    const params = new URLSearchParams({
      pa: method.upi_id,
      pn: "NexaBrew",
      am: amount.toFixed(2),
      cu: "INR",
      tn: `Order ${order.order_number}`,
    });
    const uri = `upi://pay?${params.toString()}`;
    const qr_data_url = await QRCode.toDataURL(uri, { margin: 1, width: 320 });

    return {
      order_id: order.id,
      order_number: order.order_number,
      amount,
      upi_id: method.upi_id,
      uri,
      qr_data_url,
    };
  },
};
