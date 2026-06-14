import QRCode from "qrcode";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  OrderReceipt,
  OrderWithItems,
  Payment,
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
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

  const paidAt = receipt.paid_at
    ? new Date(receipt.paid_at).toLocaleString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      })
    : "";

  const customerName = receipt.customer?.name ?? null;
  const greeting = customerName ? `Thanks, ${customerName}!` : "Payment Confirmed!";

  const rows = receipt.items
    .map(
      (item, i) => `
        <tr>
          <td style="padding:10px 0;font-size:14px;color:#0e0f0c;border-bottom:1px solid #d7ddd2;${i === 0 ? "border-top:1px solid #d7ddd2;" : ""}">${item.product_name}</td>
          <td style="padding:10px 8px;font-size:14px;color:#454745;text-align:center;border-bottom:1px solid #d7ddd2;${i === 0 ? "border-top:1px solid #d7ddd2;" : ""}">×${item.quantity}</td>
          <td style="padding:10px 0;font-size:14px;color:#0e0f0c;text-align:right;font-weight:600;border-bottom:1px solid #d7ddd2;${i === 0 ? "border-top:1px solid #d7ddd2;" : ""}">${fmt(Number(item.line_total))}</td>
        </tr>`
    )
    .join("");

  const metaRows = [
    receipt.table ? `<tr><td style="padding:4px 0;font-size:13px;color:#868685;">Table</td><td style="padding:4px 0;font-size:13px;color:#0e0f0c;font-weight:600;text-align:right;">${receipt.table.table_number}</td></tr>` : "",
    customerName ? `<tr><td style="padding:4px 0;font-size:13px;color:#868685;">Customer</td><td style="padding:4px 0;font-size:13px;color:#0e0f0c;font-weight:600;text-align:right;">${customerName}</td></tr>` : "",
    receipt.employee?.name ? `<tr><td style="padding:4px 0;font-size:13px;color:#868685;">Served by</td><td style="padding:4px 0;font-size:13px;color:#0e0f0c;font-weight:600;text-align:right;">${receipt.employee.name}</td></tr>` : "",
    paidAt ? `<tr><td style="padding:4px 0;font-size:13px;color:#868685;">Date &amp; Time</td><td style="padding:4px 0;font-size:13px;color:#0e0f0c;font-weight:600;text-align:right;">${paidAt}</td></tr>` : "",
    `<tr><td style="padding:4px 0;font-size:13px;color:#868685;">Payment</td><td style="padding:4px 0;font-size:13px;color:#0e0f0c;font-weight:600;text-align:right;">${receipt.payment.payment_method_type.toUpperCase()}</td></tr>`,
    receipt.payment.transaction_reference ? `<tr><td style="padding:4px 0;font-size:13px;color:#868685;">Reference</td><td style="padding:4px 0;font-size:13px;color:#0e0f0c;font-weight:600;text-align:right;">${receipt.payment.transaction_reference}</td></tr>` : "",
  ].filter(Boolean).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>NexaBrew Receipt — ${receipt.order_number}</title>
</head>
<body style="margin:0;padding:0;background:#e8ebe6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">
  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#e8ebe6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- ── Header ── -->
          <tr>
            <td style="background:#0e0f0c;border-radius:20px 20px 0 0;padding:28px 36px 24px;">
              <!-- Logo row -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="display:inline-block;background:#9fe870;border-radius:10px;width:38px;height:38px;line-height:38px;text-align:center;font-size:20px;">☕</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">NexaBrew</span>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9fe870;">Payment Receipt</p>
            </td>
          </tr>

          <!-- ── White card body ── -->
          <tr>
            <td style="background:#ffffff;padding:32px 36px;">

              <!-- Greeting -->
              <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;color:#0e0f0c;letter-spacing:-0.5px;">${greeting}</h1>
              <p style="margin:0 0 28px;font-size:14px;color:#868685;">Order <strong style="color:#163300;">${receipt.order_number}</strong> is fully settled. Your receipt is below.</p>

              <!-- Order meta chip row -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#e8ebe6;border-radius:14px;padding:16px 20px;margin-bottom:28px;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${metaRows}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Items -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <thead>
                  <tr>
                    <th style="text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#868685;padding-bottom:8px;">Item</th>
                    <th style="text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#868685;padding-bottom:8px;">Qty</th>
                    <th style="text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#868685;padding-bottom:8px;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>

              <!-- Totals -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:5px 0;font-size:13px;color:#454745;">Subtotal</td>
                  <td style="padding:5px 0;font-size:13px;color:#0e0f0c;text-align:right;">${fmt(receipt.subtotal)}</td>
                </tr>
                ${receipt.discount_amount > 0 ? `
                <tr>
                  <td style="padding:5px 0;font-size:13px;color:#454745;">Discount</td>
                  <td style="padding:5px 0;font-size:13px;color:#2ead4b;text-align:right;font-weight:600;">− ${fmt(receipt.discount_amount)}</td>
                </tr>` : ""}
                ${receipt.tax_amount > 0 ? `
                <tr>
                  <td style="padding:5px 0;font-size:13px;color:#454745;">Tax</td>
                  <td style="padding:5px 0;font-size:13px;color:#0e0f0c;text-align:right;">${fmt(receipt.tax_amount)}</td>
                </tr>` : ""}
                <!-- Grand total row -->
                <tr>
                  <td colspan="2" style="padding-top:4px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:#0e0f0c;border-radius:12px;padding:14px 20px;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="font-size:15px;font-weight:700;color:#9fe870;">Total Paid</td>
                              <td style="font-size:22px;font-weight:800;color:#9fe870;text-align:right;letter-spacing:-0.5px;">${fmt(receipt.total_amount)}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <p style="margin:0;font-size:13px;color:#868685;text-align:center;">We hope to see you again soon ✨</p>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="background:#0e0f0c;border-radius:0 0 20px 20px;padding:20px 36px;text-align:center;">
              <p style="margin:0;font-size:13px;font-weight:600;color:#9fe870;">NexaBrew Café</p>
              <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.35);">Parul University, Vadodara · nxbrew.vercel.app</p>
            </td>
          </tr>

          <!-- Spacer -->
          <tr><td style="height:32px;"></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

    const gmailUser = process.env.GMAIL_USER?.trim();
    const gmailPass = process.env.GMAIL_APP_PASSWORD?.trim();
    const useGmail = Boolean(gmailUser && gmailPass);

    // Recipient resolution. Gmail SMTP can deliver to ANY address, so it goes
    // straight to the customer. The RECEIPT_EMAIL_OVERRIDE_TO demo override only
    // applies on the Resend fallback (Resend's sandbox is owner-only).
    const override = useGmail ? undefined : process.env.RECEIPT_EMAIL_OVERRIDE_TO?.trim();
    const to = override || email || receipt.customer?.email;
    if (!to) throw new AppError("Receipt email is required", "RECEIPT_EMAIL_REQUIRED", 400);

    const subject = `NexaBrew receipt ${receipt.order_number}`;
    const text = receiptText(receipt);
    const html = receiptHtml(receipt);

    // ── Preferred transport: Gmail SMTP (delivers to any customer) ──────────
    if (useGmail) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
      });
      try {
        const info = await transporter.sendMail({
          from: `NexaBrew <${gmailUser}>`,
          to,
          subject,
          text,
          html,
        });
        return { receipt, email: to, id: info.messageId ?? null };
      } catch (err) {
        throw new AppError((err as Error).message, "RECEIPT_EMAIL_FAILED", 502);
      }
    }

    // ── Fallback: Resend ────────────────────────────────────────────────────
    if (!emailConfigured()) {
      throw new AppError("Receipt email is not configured", "RECEIPT_EMAIL_NOT_CONFIGURED", 501);
    }
    // Configurable sender — once a domain is verified in Resend, set
    // RECEIPT_EMAIL_FROM (e.g. "NexaBrew <receipts@yourdomain.com>") with no code change.
    const from = process.env.RECEIPT_EMAIL_FROM?.trim() || "NexaBrew <onboarding@resend.dev>";

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({ from, to, subject, text, html });
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
