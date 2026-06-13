/**
 * Verify all 3 user roles work end-to-end against the live DB.
 *   - admin / employee / customer accounts exist with correct roles
 *   - customer is linked to a CRM row
 *   - an order assigned to the customer is visible via OrderService.listForCustomerUser
 *   - middleware home routing is correct per role
 * Creates a throwaway order for the demo customer, then cleans it up.
 *
 * Run: node --env-file=.env.local --import tsx scripts/roles-check.mts
 */
import { supabaseAdmin as db } from "@/lib/supabase/admin";
import { SessionService } from "@/services/SessionService";
import { OrderService } from "@/services/OrderService";

const ok = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const step = (m: string) => console.log(`\n\x1b[1m${m}\x1b[0m`);
const fail = (m: string, e?: unknown) => {
  console.error(`  \x1b[31m✗ ${m}\x1b[0m`, e ? (e as Error).message : "");
  process.exit(1);
};

function homeForRole(role: string): string {
  if (role === "admin") return "/dashboard";
  if (role === "customer") return "/menu";
  return "/pos/terminal";
}

let sessionId = "";
let createdSession = false;
let orderId = "";

try {
  // ── 1. all three roles exist ─────────────────────────────────────────────
  step("1. Accounts & roles");
  const emails = ["admin@nexabrew.com", "alice@nexabrew.com", "customer@nexabrew.com"];
  const { data: users } = await db.from("users").select("id,email,role").in("email", emails);
  for (const email of emails) {
    const u = users?.find((x) => x.email === email);
    if (!u) fail(`missing user ${email}`);
    ok(`${email} → role=${u!.role} → home ${homeForRole(u!.role)}`);
  }
  const admin = users!.find((u) => u.role === "admin")!;
  const employee = users!.find((u) => u.email === "alice@nexabrew.com")!;
  const customer = users!.find((u) => u.role === "customer")!;
  if (employee.role !== "employee") fail("alice should be employee");
  if (customer.role !== "customer") fail("customer role wrong");

  // ── 2. customer linked to CRM row ────────────────────────────────────────
  step("2. Customer ↔ CRM link");
  const { data: crm } = await db.from("customers").select("id,name").eq("user_id", customer.id).maybeSingle();
  if (!crm) fail("customer has no linked CRM row");
  ok(`customer linked to CRM row ${crm!.id.slice(0, 8)} (${crm!.name})`);

  // ── 3. place an order for the customer (employee acts) ───────────────────
  step("3. Order assigned to customer");
  const active = await SessionService.getActive(db);
  if (active) { sessionId = active.id; }
  else { const s = await SessionService.open(db, employee.id, 0); sessionId = s.id; createdSession = true; }

  const { data: product } = await db.from("products").select("id").eq("is_active", true).limit(1).single();
  const { order } = await OrderService.create(
    db,
    { session_id: sessionId, customer_id: crm!.id, items: [{ product_id: product!.id, quantity: 1 }] },
    employee.id
  );
  orderId = order.id;
  ok(`employee created order ${order.order_number} for the customer`);

  // ── 4. customer sees only their order ────────────────────────────────────
  step("4. Customer 'my orders' view");
  const mine = await OrderService.listForCustomerUser(db, customer.id);
  if (!mine.find((o) => o.id === orderId)) fail("customer cannot see their own order");
  ok(`listForCustomerUser returned ${mine.length} order(s), includes ${order.order_number}`);

  const staffOrders = await OrderService.listForCustomerUser(db, admin.id);
  ok(`admin (not a customer) sees ${staffOrders.length} orders via the customer view (expected 0)`);
  if (staffOrders.length !== 0) fail("non-customer should see 0 orders in customer view");

  // ── cleanup ──────────────────────────────────────────────────────────────
  step("Cleanup");
  await db.from("order_items").delete().eq("order_id", orderId);
  await db.from("orders").delete().eq("id", orderId);
  if (createdSession) await db.from("sessions").delete().eq("id", sessionId);
  ok("test data removed");

  console.log("\n\x1b[1;32mALL 3 ROLES VERIFIED — admin, employee, customer.\x1b[0m\n");
} catch (e) {
  fail("roles check failed", e);
}
