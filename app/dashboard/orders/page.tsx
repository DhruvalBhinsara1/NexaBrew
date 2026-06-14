"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, Printer, ShoppingCart, Trash2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Sheet,
    SheetContent,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { PaymentDialog } from "@/components/pos/PaymentDialog";
import { ReceiptDialog } from "@/components/pos/ReceiptDialog";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiSend } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatDateTimeIST } from "@/lib/utils/datetime";
import type { OrderWithItems } from "@/types/domain.types";
import type { PaginatedResponse } from "@/types/pagination.types";

function fmt(iso: string | null): string {
    return formatDateTimeIST(iso);
}

const STATUS_COLORS: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    sent_to_kitchen: "bg-blue-100 text-blue-700",
    payment_pending: "bg-amber-100 text-amber-700",
    paid: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
};

export default function OrdersPage(): React.ReactElement {
    const { toast } = useToast();
    const [orders, setOrders] = useState<OrderWithItems[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);
    const [search, setSearch] = useState("");

    // Detail / payment / receipt
    const [selected, setSelected] = useState<OrderWithItems | null>(null);
    const [payingOrder, setPayingOrder] = useState<OrderWithItems | null>(null);
    const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async (currentPage: number = 1) => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.set("page", String(currentPage));
            params.set("limit", String(pageSize));
            if (search) {
                params.set("search", search);
            }

            const data = await apiGet<PaginatedResponse<OrderWithItems>>(
                `/api/orders?${params.toString()}`
            );

            if (!data?.data || !data?.pagination) {
                throw new Error("Invalid response format");
            }

            setOrders(data.data);
            setPage(data.pagination.page);
            setTotalPages(data.pagination.totalPages);
            setHasNextPage(data.pagination.hasNextPage);
            setHasPreviousPage(data.pagination.hasPreviousPage);
        } catch (e) {
            toast({ title: (e as Error).message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [pageSize, search, toast]);

    useEffect(() => {
        void load(1);
    }, [load]);

    async function cancelOrder(o: OrderWithItems): Promise<void> {
        if (!confirm(`Cancel order ${o.order_number}?`)) return;
        setBusy(true);
        try {
            await apiSend(`/api/orders/${o.id}/cancel`, "POST");
            toast({ title: "Order cancelled" });
            setSelected(null);
            await load(page);
        } catch (e) {
            toast({ title: (e as Error).message, variant: "destructive" });
        } finally {
            setBusy(false);
        }
    }

    async function deleteOrder(o: OrderWithItems): Promise<void> {
        if (!confirm(`Delete draft order ${o.order_number}? This cannot be undone.`)) return;
        setBusy(true);
        try {
            await apiSend(`/api/orders/${o.id}`, "DELETE");
            toast({ title: "Order deleted" });
            setSelected(null);
            await load(page);
        } catch (e) {
            toast({ title: (e as Error).message, variant: "destructive" });
        } finally {
            setBusy(false);
        }
    }

    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);

    return (
        <div className="space-y-6 p-6">
            <PageHeader
                title="Orders"
                subtitle="View and manage all orders"
            />

            {/* Summary */}
            {!loading && (
                <Card className="border-wise-primary-pale bg-wise-primary-pale">
                    <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-wise-body">Total Revenue (this page)</p>
                                <p className="text-2xl font-bold text-wise-ink-deep">{formatCurrency(totalRevenue)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-medium text-wise-body">Orders</p>
                                <p className="text-2xl font-bold text-wise-ink-deep">{orders.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Filters & Orders */}
            <Card className="border-wise-border">
                <CardContent className="p-0">
                    {orders.length === 0 && !loading ? (
                        <EmptyState icon={ShoppingCart} title="No orders yet" subtitle="Orders will appear here once created." />
                    ) : (
                        <>
                            {/* Search */}
                            <div className="border-b border-wise-border p-4">
                                <Label htmlFor="search-orders" className="text-xs font-medium text-wise-body">
                                    Search by Order Number
                                </Label>
                                <Input
                                    id="search-orders"
                                    placeholder="e.g., ORD-001"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            {/* Loading State */}
                            {loading && (
                                <div className="flex items-center justify-center gap-2 py-8 text-wise-mute">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                                </div>
                            )}

                            {/* Table */}
                            {!loading && orders.length > 0 && (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-wise-border text-xs uppercase tracking-wider text-wise-mute">
                                                    <th className="px-4 py-3 text-left">Order Number</th>
                                                    <th className="px-4 py-3 text-left">Customer</th>
                                                    <th className="px-4 py-3 text-left">Table</th>
                                                    <th className="px-4 py-3 text-left">Employee</th>
                                                    <th className="px-4 py-3 text-right">Total</th>
                                                    <th className="px-4 py-3 text-left">Created</th>
                                                    <th className="px-4 py-3 text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {orders.map((order) => (
                                                    <tr
                                                        key={order.id}
                                                        onClick={() => setSelected(order)}
                                                        className="cursor-pointer border-b border-wise-border last:border-0 hover:bg-wise-canvas-soft"
                                                    >
                                                        <td className="px-4 py-3 font-medium text-wise-ink">{order.order_number}</td>
                                                        <td className="px-4 py-3 text-wise-body">{order.customer?.name ?? "—"}</td>
                                                        <td className="px-4 py-3 text-wise-body">
                                                            {order.table ? `Table ${order.table.table_number}` : "—"}
                                                        </td>
                                                        <td className="px-4 py-3 text-wise-body">{order.employee?.name ?? "—"}</td>
                                                        <td className="px-4 py-3 text-right font-medium text-wise-ink">
                                                            {formatCurrency(Number(order.total_amount))}
                                                        </td>
                                                        <td className="px-4 py-3 text-wise-body">{fmt(order.created_at)}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span
                                                                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[order.status] || "bg-wise-canvas-soft text-wise-body"
                                                                    }`}
                                                            >
                                                                {order.status.replace(/_/g, " ")}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="border-t border-wise-border p-4">
                                        <Pagination
                                            page={page}
                                            totalPages={totalPages}
                                            hasNextPage={hasNextPage}
                                            hasPreviousPage={hasPreviousPage}
                                            onPageChange={(newPage) => void load(newPage)}
                                            pageSize={pageSize}
                                            onPageSizeChange={(s) => { setPageSize(s); void load(1); }}
                                            isLoading={loading}
                                        />
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Order detail sheet */}
            <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                    {selected && (
                        <>
                            <SheetHeader>
                                <SheetTitle className="flex items-center gap-2">
                                    Order {selected.order_number}
                                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_COLORS[selected.status] ?? "bg-wise-canvas-soft text-wise-body")}>
                                        {selected.status.replace(/_/g, " ")}
                                    </span>
                                </SheetTitle>
                            </SheetHeader>

                            <div className="mt-4 space-y-1 text-sm text-wise-body">
                                <p>Table: {selected.table ? `Table ${selected.table.table_number}` : "—"}</p>
                                <p>Customer: {selected.customer?.name ?? "Walk-in"}</p>
                                <p>Employee: {selected.employee?.name ?? "—"}</p>
                                <p>Created: {fmt(selected.created_at)}</p>
                            </div>

                            <Separator className="my-4" />

                            {selected.items.length === 0 ? (
                                <p className="text-sm text-wise-mute">No items on this bill.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {selected.items.map((it) => (
                                        <li key={it.id} className="flex justify-between text-sm">
                                            <span className="text-wise-body">{it.product_name} × {it.quantity}</span>
                                            <span className="font-medium text-wise-ink">{formatCurrency(Number(it.line_total))}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            <Separator className="my-4" />

                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between text-wise-body"><span>Subtotal</span><span>{formatCurrency(Number(selected.subtotal))}</span></div>
                                <div className="flex justify-between text-wise-body"><span>Discount</span><span>−{formatCurrency(Number(selected.discount_amount))}</span></div>
                                <div className="flex justify-between text-wise-body"><span>Tax</span><span>{formatCurrency(Number(selected.tax_amount))}</span></div>
                                <div className="flex justify-between text-base font-bold text-wise-ink"><span>Total</span><span>{formatCurrency(Number(selected.total_amount))}</span></div>
                            </div>

                            {selected.status === "payment_pending" && (
                                <SheetFooter className="mt-6">
                                    <Button
                                        className="w-full bg-wise-primary text-wise-ink hover:bg-wise-primary-active"
                                        onClick={() => setPayingOrder(selected)}
                                    >
                                        <CreditCard className="mr-2 h-4 w-4" /> Process Payment
                                    </Button>
                                </SheetFooter>
                            )}

                            {selected.status === "paid" && (
                                <SheetFooter className="mt-6">
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => setReceiptOrderId(selected.id)}
                                    >
                                        <Printer className="mr-2 h-4 w-4" /> Print Receipt
                                    </Button>
                                </SheetFooter>
                            )}

                            {(selected.status === "draft" || selected.status === "sent_to_kitchen") && (
                                <SheetFooter className="mt-6 flex-col gap-2 sm:flex-col">
                                    {selected.status === "draft" && (
                                        <Button variant="outline" className="w-full" onClick={() => void deleteOrder(selected)} disabled={busy}>
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete Draft
                                        </Button>
                                    )}
                                    <Button variant="destructive" className="w-full" onClick={() => void cancelOrder(selected)} disabled={busy}>
                                        <XCircle className="mr-2 h-4 w-4" /> Cancel Order
                                    </Button>
                                </SheetFooter>
                            )}
                        </>
                    )}
                </SheetContent>
            </Sheet>

            {/* Process Payment */}
            {payingOrder && (
                <PaymentDialog
                    orderId={payingOrder.id}
                    orderNumber={payingOrder.order_number}
                    total={Number(payingOrder.total_amount)}
                    customerName={payingOrder.customer?.name}
                    open={!!payingOrder}
                    onClose={() => setPayingOrder(null)}
                    onPaid={() => {
                        setSelected(null);
                        void load(page);
                    }}
                    toast={(msg, variant) =>
                        toast({ title: msg, variant: variant === "error" ? "destructive" : "default" })
                    }
                />
            )}

            <ReceiptDialog
                orderId={receiptOrderId}
                open={!!receiptOrderId}
                onClose={() => setReceiptOrderId(null)}
                toast={(msg, variant) =>
                    toast({ title: msg, variant: variant === "error" ? "destructive" : "default" })
                }
            />
        </div>
    );
}
