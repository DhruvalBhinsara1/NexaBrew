/**
 * NexaBrew database seed (TASKS.md Phase 1.7).
 * Run with:  npm run seed   (loads .env.local via Node --env-file)
 *
 * Idempotent: keyed tables upsert; list tables guard on existing rows; users
 * are created via the Admin API and skipped if they already exist.
 *
 * Demo login password is read from SEED_DEMO_PASSWORD, with a local-only
 * fallback suitable for disposable development databases.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run via `npm run seed`."
  );
  process.exit(1);
}

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "ChangeMe@12345";

const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const CATEGORIES = [
  { name: "Coffee", color: "#6F4E37" },
  { name: "Tea", color: "#2ECC71" },
  { name: "Cold Drinks", color: "#3498DB" },
  { name: "Snacks", color: "#F39C12" },
  { name: "Desserts", color: "#E91E63" },
  { name: "Meals", color: "#9B59B6" },
];

const PRODUCTS = [
  { name: "Espresso", category: "Coffee", price: 80, tax_rate: 5 },
  { name: "Cappuccino", category: "Coffee", price: 120, tax_rate: 5 },
  { name: "Masala Chai", category: "Tea", price: 60, tax_rate: 5 },
  { name: "Green Tea", category: "Tea", price: 80, tax_rate: 5 },
  { name: "Cold Coffee", category: "Cold Drinks", price: 150, tax_rate: 12 },
  { name: "Lemonade", category: "Cold Drinks", price: 100, tax_rate: 12 },
  { name: "Sandwich", category: "Snacks", price: 120, tax_rate: 12 },
  { name: "Samosa", category: "Snacks", price: 40, tax_rate: 12 },
  { name: "Chocolate Brownie", category: "Desserts", price: 130, tax_rate: 12 },
  { name: "Cheesecake", category: "Desserts", price: 180, tax_rate: 12 },
  { name: "Pasta", category: "Meals", price: 220, tax_rate: 12 },
  { name: "Paneer Wrap", category: "Meals", price: 200, tax_rate: 12 },
];

const FLOORS = [
  { name: "Ground Floor", from: 1, to: 8, seats: 4 },
  { name: "First Floor", from: 9, to: 14, seats: 6 },
  { name: "Terrace", from: 15, to: 18, seats: 4 },
];

const COUPONS = [
  { code: "SAVE10", discount_type: "percentage", discount_value: 10 },
  { code: "FLAT50", discount_type: "fixed", discount_value: 50 },
  { code: "WELCOME20", discount_type: "percentage", discount_value: 20 },
];

const USERS = [
  { name: "Admin User", email: "admin@nexabrew.com", role: "admin" },
  { name: "Alice Cashier", email: "alice@nexabrew.com", role: "employee" },
  { name: "Bob Cashier", email: "bob@nexabrew.com", role: "employee" },
];

function fail(label: string, error: { message: string } | null): void {
  if (error) {
    console.error(`✗ ${label}: ${error.message}`);
    process.exit(1);
  }
}

async function seedPaymentMethods(): Promise<void> {
  const { error } = await supabase
    .from("payment_methods")
    .upsert(
      [
        { type: "cash", is_enabled: true, upi_id: null },
        { type: "card", is_enabled: true, upi_id: null },
        { type: "upi", is_enabled: true, upi_id: "nexabrew@ybl" },
      ],
      { onConflict: "type" }
    );
  fail("payment_methods", error);
  console.log("✓ payment_methods (3)");
}

async function seedCategories(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("categories")
    .upsert(CATEGORIES, { onConflict: "name" })
    .select("id, name");
  fail("categories", error);
  const map = new Map<string, string>();
  for (const row of data ?? []) map.set(row.name, row.id);
  console.log(`✓ categories (${map.size})`);
  return map;
}

async function seedProducts(categoryIds: Map<string, string>): Promise<void> {
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    console.log("• products already present — skipping");
    return;
  }
  const rows = PRODUCTS.map((p) => ({
    name: p.name,
    category_id: categoryIds.get(p.category) ?? null,
    price: p.price,
    tax_rate: p.tax_rate,
    unit_of_measure: "piece",
    is_kitchen_display: true,
    is_active: true,
  }));
  const { error } = await supabase.from("products").insert(rows);
  fail("products", error);
  console.log(`✓ products (${rows.length})`);
}

async function seedFloorsAndTables(): Promise<void> {
  const { count } = await supabase
    .from("floors")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    console.log("• floors already present — skipping");
    return;
  }
  for (const floor of FLOORS) {
    const { data, error } = await supabase
      .from("floors")
      .insert({ name: floor.name })
      .select("id")
      .single();
    fail(`floor ${floor.name}`, error);
    const floorId = data!.id;
    const tables = [];
    for (let n = floor.from; n <= floor.to; n += 1) {
      tables.push({
        floor_id: floorId,
        table_number: n,
        seats: floor.seats,
        is_active: true,
        status: "available",
      });
    }
    const { error: tErr } = await supabase.from("tables").insert(tables);
    fail(`tables for ${floor.name}`, tErr);
  }
  console.log("✓ floors (3) + tables (18)");
}

async function seedCoupons(): Promise<void> {
  const { error } = await supabase
    .from("coupons")
    .upsert(
      COUPONS.map((c) => ({ ...c, is_active: true })),
      { onConflict: "code" }
    );
  fail("coupons", error);
  console.log(`✓ coupons (${COUPONS.length})`);
}

async function seedPromotions(): Promise<void> {
  const { count } = await supabase
    .from("promotions")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    console.log("• promotions already present — skipping");
    return;
  }
  // NOTE: schema supports single-product promotions (no category-level). The
  // demo "Buy 3 Coffee Deal" is mapped to the Espresso product.
  const { data: espresso } = await supabase
    .from("products")
    .select("id")
    .eq("name", "Espresso")
    .maybeSingle();

  const rows = [
    {
      name: "Buy 3 Coffee Deal",
      applies_to: "product",
      product_id: espresso?.id ?? null,
      min_quantity: 3,
      min_order_amount: null,
      discount_type: "percentage",
      discount_value: 15,
      is_active: true,
    },
    {
      name: "Big Order Reward",
      applies_to: "order",
      product_id: null,
      min_quantity: null,
      min_order_amount: 500,
      discount_type: "fixed",
      discount_value: 50,
      is_active: true,
    },
  ];
  const { error } = await supabase.from("promotions").insert(rows);
  fail("promotions", error);
  console.log(`✓ promotions (${rows.length})`);
}

async function seedUsers(): Promise<void> {
  for (const u of USERS) {
    const { error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { name: u.name, role: u.role },
    });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        console.log(`• user ${u.email} already exists — skipping`);
      } else {
        console.error(`✗ user ${u.email}: ${error.message}`);
        process.exit(1);
      }
    } else {
      console.log(`✓ user ${u.email} (${u.role})`);
    }
  }
}

async function main(): Promise<void> {
  console.log("Seeding NexaBrew demo data...\n");
  await seedPaymentMethods();
  const categoryIds = await seedCategories();
  await seedProducts(categoryIds);
  await seedFloorsAndTables();
  await seedCoupons();
  await seedPromotions();
  await seedUsers();
  console.log(`\nDone. Demo login password for all accounts: ${DEMO_PASSWORD}`);
}

main().catch((err: unknown) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
