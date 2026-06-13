/**
 * Live end-to-end demo verification (headless, against the live Supabase DB).
 * Drives the same service calls the UI triggers:
 *   session -> order -> send to kitchen -> KDS advance -> cash payment -> reports
 * Plus a real Razorpay test-mode order creation. Cleans up after itself.
 *
 * Run: node --env-file=.env.local --import tsx scripts/demo-flow.mts
 */
import { supabaseAdmin as db } from "@/lib/supabase/admin";
import { SessionService } from "@/services/SessionService";
import { OrderService } from "@/services/OrderService";
import { KitchenService } from "@/services/KitchenService";
import { PaymentService } from "@/services/PaymentService";
import { ReportService } from "@/services/ReportService";
import { getRazorpayClient } from "@/lib/razorpay";

const ok = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const step = (m: string) => console.log(`\n\x1b[1m${m}\x1b[0m`);
const fail = (m: string, e: unknown) => {
  console.error(`  \x1b[31m✗ ${m}\x1b[0m`, (e as Error).message);
  process.exit(1);
};

const today = new Date().toISOString().slice(0, 10);
let sessionId = "";
let createdSession = false;
let orderId = "";
let ticketId = "";

try {
  // ── actors / fixtures ────────────────────────────────────────────────────
  const { data: admin } = await db.from("users").select("id").eq("role", "admin").limit(1).single();
  const employeeId = admin!.id;

  const { data: products } = await db
    .from("products").select("id, name, price, tax_rate").eq("is_active", true).limit(2);
  if (!products || products.length < 2) throw new Error("Need 2 active products seeded");

  const { data: table } = await db
    .from("tables").select("id, table_number").eq("status", "available").eq("is_active", true).limit(1).single();
  if (!table) throw new Error("No available table");

  // ── 1. session ───────────────────────────────────────────────────────────
  step("1. Session");
  const active = await SessionService.getActive(db);
  if (active) { sessionId = active.id; ok(`reusing open session ${sessionId.slice(0, 8)}`); }
  else {
    const s = await SessionService.open(db, employeeId, 1000);
    sessionId = s.id; createdSession = true;
    ok(`opened session ${sessionId.slice(0, 8)} (opening ₹1000)`);
  }

  // ── 2. create order ──────────────────────────────────────────────────────
  step("2. Create order");
  const { order, created } = await OrderService.create(
    db,
    { session_id: sessionId, table_id: table.id, items: [
      { product_id: products[0].id, quantity: 2 },
      { product_id: products[1].id, quantity: 1 },
    ] },
    employeeId
  );
  orderId = order.id;
  ok(`order ${order.order_number} created=${created}, status=${order.status}, total=₹${order.total_amount}`);
  if (order.status !== "draft") throw new Error("expected draft");
  if (order.items.length !== 2) throw new Error("expected 2 line items");

  // a draft does NOT occupy the table — it stays available until sent to kitchen
  const { data: t2 } = await db.from("tables").select("status").eq("id", table.id).single();
  if (t2!.status !== "available") throw new Error("table should still be available for a draft");
  ok(`table T${table.table_number} still available (draft does not occupy)`);

  // ── 3. active-order reuse (DECISION-004) ─────────────────────────────────
  step("3. Active-order strategy");
  const again = await OrderService.create(db, { session_id: sessionId, table_id: table.id, items: [] }, employeeId);
  if (again.created || again.order.id !== orderId) throw new Error("should return same draft");
  ok("same table returns same draft (created=false)");

  // ── 4. send to kitchen ───────────────────────────────────────────────────
  step("4. Send to kitchen");
  const sk = await KitchenService.sendToKitchen(db, orderId);
  ticketId = sk.ticket.id;
  ok(`ticket ${sk.ticket.ticket_number} status=${sk.ticket.status}, order=${sk.order.status}`);
  if (sk.order.status !== "sent_to_kitchen") throw new Error("order should be sent_to_kitchen");

  const { data: t3 } = await db.from("tables").select("status").eq("id", table.id).single();
  if (t3!.status !== "occupied") throw new Error("table should be occupied after send-to-kitchen");
  ok(`table T${table.table_number} -> occupied (on send-to-kitchen)`);

  // ── 5. KDS advance to completed (DECISION-005) ───────────────────────────
  step("5. KDS advance");
  await KitchenService.advanceTicketStatus(db, ticketId, "preparing");
  ok("ticket -> preparing");
  const done = await KitchenService.advanceTicketStatus(db, ticketId, "completed");
  ok(`ticket -> completed, order -> ${done.order?.status}`);
  if (done.order?.status !== "payment_pending") throw new Error("order should be payment_pending");

  // ── 6. cash payment ──────────────────────────────────────────────────────
  step("6. Cash payment");
  const total = Number((await OrderService.getById(db, orderId)).total_amount);
  const pay = await PaymentService.process(db, orderId, {
    payment_method_type: "cash",
    amount_tendered: Math.ceil(total) + 50,
  });
  ok(`paid ₹${pay.payment.amount_paid}, change ₹${pay.payment.change_due}, order=${pay.order.status}`);
  if (pay.order.status !== "paid") throw new Error("order should be paid");

  // table freed?
  const { data: t3 } = await db.from("tables").select("status").eq("id", table.id).single();
  if (t3!.status !== "available") throw new Error("table should be freed");
  ok(`table T${table.table_number} -> available`);

  // ── 7. reports reflect it ────────────────────────────────────────────────
  step("7. Reports");
  const daily = await ReportService.dailySummary(db, { from: today, to: today });
  const row = daily.find((r) => r.date === today);
  ok(`daily report: ${row?.order_count ?? 0} orders, ₹${row?.total_revenue ?? 0} revenue today`);
  if (!row || row.order_count < 1) throw new Error("today's paid order missing from report");

  // ── 8. Razorpay live test-mode order ─────────────────────────────────────
  step("8. Razorpay (test mode)");
  const rzp = getRazorpayClient();
  const rzpOrder = await rzp.orders.create({ amount: 15000, currency: "INR", receipt: "demo-verify" });
  ok(`Razorpay order ${rzpOrder.id} created (amount ₹${Number(rzpOrder.amount) / 100}, status=${rzpOrder.status})`);

  // ── cleanup ──────────────────────────────────────────────────────────────
  step("Cleanup");
  await db.from("kitchen_ticket_items").delete().eq("ticket_id", ticketId);
  await db.from("kitchen_tickets").delete().eq("id", ticketId);
  await db.from("payments").delete().eq("order_id", orderId);
  await db.from("order_items").delete().eq("order_id", orderId);
  await db.from("orders").delete().eq("id", orderId);
  if (createdSession) await db.from("sessions").delete().eq("id", sessionId);
  ok("test data removed");

  console.log("\n\x1b[1;32mALL CHECKS PASSED — full POS flow verified against live DB.\x1b[0m\n");
} catch (e) {
  fail("flow failed", e);
}
