import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

interface PaginationProps {
    page: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    onPageChange: (page: number) => void;
    pageSize?: number;
    onPageSizeChange?: (size: number) => void;
    isLoading?: boolean;
    className?: string;
}

export function Pagination({
    page,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    onPageChange,
    pageSize,
    onPageSizeChange,
    isLoading = false,
    className,
}: PaginationProps) {
    return (
        <div className={cn("flex items-center justify-between gap-4", className)}>
            {/* Page-size selector */}
            <div className="flex items-center gap-2 text-sm text-wise-body">
                <span className="shrink-0">Show</span>
                <select
                    value={pageSize ?? 10}
                    onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
                    disabled={!onPageSizeChange || isLoading}
                    className="rounded-md border border-wise-border bg-white px-2 py-1 text-sm text-wise-body focus:outline-none focus:ring-2 focus:ring-wise-primary disabled:opacity-40"
                >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                        <option key={n} value={n}>{n}</option>
                    ))}
                </select>
                <span className="shrink-0">per page</span>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-3">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page - 1)}
                    disabled={!hasPreviousPage || isLoading}
                    className="gap-1.5"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                </Button>

                <span className="text-sm font-medium text-wise-body tabular-nums">
                    {page} / {totalPages}
                </span>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page + 1)}
                    disabled={!hasNextPage || isLoading}
                    className="gap-1.5"
                >
                    Next
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
