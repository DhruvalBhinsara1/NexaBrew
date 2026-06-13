"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { apiGet } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import type { OrderWithItems } from "@/types/domain.types";
import type { PaginatedResponse } from "@/types/pagination.types";

function fmt(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
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

    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);

    return (
        <div className="space-y-6 p-6">
            <PageHeader
                title="Orders"
                subtitle="View and manage all orders"
            />

            {/* Summary */}
            {!loading && (
                <Card className="border-wise-border bg-gradient-to-br from-wise-primary to-wise-primary/50">
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
                                                    <tr key={order.id} className="border-b border-wise-border last:border-0 hover:bg-wise-canvas-soft">
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
        </div>
    );
}
