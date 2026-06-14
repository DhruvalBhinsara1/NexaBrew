import { formatCurrency } from "@/lib/utils/formatCurrency";
import { STORE_INFO } from "./storeConfig";
import type { OrderReceipt } from "@/types/domain.types";

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
  );
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function methodLabel(t: string): string {
  const map: Record<string, string> = { cash: "Cash", card: "Card", upi: "UPI", razorpay: "Razorpay" };
  return map[t] ?? t;
}

/**
 * Render a classic narrow thermal-printer receipt as a full, self-contained
 * HTML document (inline CSS, monospace). `qrDataUrl` is an optional QR image.
 * The output is identical whether shown in a preview iframe, printed, or saved.
 */
export function renderReceiptHtml(receipt: OrderReceipt, qrDataUrl?: string): string {
  const p = receipt.payment;
  const itemsCount = receipt.items.reduce((s, it) => s + it.quantity, 0);

  const rows = receipt.items
    .map((it, i) => {
      const name = esc(it.product_name);
      return `
        <tr class="item">
          <td class="sr">${i + 1}</td>
          <td class="name">${name}</td>
          <td class="qty">${it.quantity}</td>
          <td class="price">${formatCurrency(Number(it.line_total))}</td>
        </tr>`;
    })
    .join("");

  const tendered =
    p.amount_tendered != null
      ? `<div class="row"><span>Tendered</span><span>${formatCurrency(Number(p.amount_tendered))}</span></div>`
      : "";
  const change =
    p.change_due != null && Number(p.change_due) > 0
      ? `<div class="row"><span>Change</span><span>${formatCurrency(Number(p.change_due))}</span></div>`
      : "";
  const ref = p.transaction_reference
    ? `<div class="meta">Ref: ${esc(p.transaction_reference)}</div>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Receipt ${esc(receipt.order_number)}</title>
<style>
  :root { --ink:#111; }
  * { box-sizing: border-box; }
  html,body { margin:0; padding:0; background:#f4f4f5; }
  .receipt {
    width: 280px; margin: 0 auto; background:#fff; color:var(--ink);
    font-family: "Courier New", ui-monospace, Menlo, Consolas, monospace;
    font-size: 12px; line-height: 1.5; padding: 16px 14px 20px;
  }
  .center { text-align:center; }
  .qr { display:block; margin: 0 auto 8px; width: 72px; height:72px; image-rendering: pixelated; }
  .store { font-size: 18px; font-weight: 700; letter-spacing:.5px; margin: 2px 0; }
  .muted { color:#444; }
  .tin { font-weight:700; margin: 4px 0; }
  .addr { margin: 1px 0; }
  .title { font-weight:700; font-size: 14px; margin: 10px 0 2px; }
  .hr { border:none; border-top:1px dashed #999; margin: 8px 0; }
  table { width:100%; border-collapse: collapse; }
  thead th { text-align:left; font-weight:700; padding-bottom:2px; }
  th.qty, td.qty, th.price, td.price { text-align:right; }
  td.sr { width:14px; vertical-align:top; color:#555; }
  td.name { word-break: break-word; padding-right:6px; }
  td.qty { width:30px; vertical-align:top; }
  td.price { width:64px; vertical-align:top; white-space:nowrap; }
  tr.item td { padding: 2px 0; vertical-align: top; }
  .totals { margin-top: 2px; }
  .row { display:flex; justify-content: space-between; }
  .row.grand { font-weight:700; font-size: 14px; margin-top: 2px; }
  .meta { margin-top: 6px; color:#333; }
  .foot { margin-top: 10px; }
  .foot .thanks { font-weight:700; letter-spacing:.5px; margin-top: 8px; }
  @media print {
    html,body { background:#fff; }
    .receipt { width: 100%; padding: 0; }
    @page { margin: 6mm; }
  }
</style></head>
<body>
  <div class="receipt">
    <div class="center">
      ${qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="QR" />` : ""}
      <div class="store">${esc(STORE_INFO.name)}</div>
      <div class="tin">${STORE_INFO.taxLabel} : ${esc(STORE_INFO.gstin)}</div>
      ${STORE_INFO.addressLines.map((l) => `<div class="addr muted">${esc(l)}</div>`).join("")}
      <div class="addr muted">Phone: ${esc(STORE_INFO.phone)}</div>
      <div class="addr muted">${esc(STORE_INFO.email)}</div>
      <div class="title">Tax Invoice</div>
    </div>

    <div class="row"><span>Bill: ${esc(receipt.order_number)}</span><span>${fmtDateTime(receipt.paid_at)}</span></div>
    <div class="row muted">
      <span>${receipt.table ? "Table " + receipt.table.table_number : "Walk-in"}</span>
      <span>${esc(receipt.customer?.name ?? "Cash Customer")}</span>
    </div>

    <hr class="hr" />
    <table>
      <thead>
        <tr><th class="sr">#</th><th>Item</th><th class="qty">Qty</th><th class="price">Price</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <hr class="hr" />

    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${formatCurrency(Number(receipt.subtotal))}</span></div>
      ${Number(receipt.discount_amount) > 0 ? `<div class="row"><span>Discount</span><span>-${formatCurrency(Number(receipt.discount_amount))}</span></div>` : ""}
      <div class="row"><span>${STORE_INFO.taxLabel}</span><span>${formatCurrency(Number(receipt.tax_amount))}</span></div>
      <div class="row grand"><span>Total</span><span>${formatCurrency(Number(receipt.total_amount))}</span></div>
      ${tendered}${change}
    </div>

    <hr class="hr" />
    <div class="row"><span>Items #: ${itemsCount}</span><span>${methodLabel(p.payment_method_type)}</span></div>
    <div class="meta">Cashier: ${esc(receipt.employee?.name ?? "—")}</div>
    ${ref}

    <div class="foot center">
      ${STORE_INFO.footerLines.map((l) => `<div class="muted">${esc(l)}</div>`).join("")}
      <div class="thanks">${esc(STORE_INFO.thanks)}</div>
    </div>
  </div>
</body></html>`;
}
