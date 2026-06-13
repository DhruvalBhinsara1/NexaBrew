import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface PaginationProps {
    page: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    onPageChange: (page: number) => void;
    isLoading?: boolean;
    className?: string;
}

/**
 * Reusable pagination component
 */
export function Pagination({
    page,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    onPageChange,
    isLoading = false,
    className,
}: PaginationProps) {
    return (
        <div className={cn("flex items-center justify-between gap-4", className)}>
            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page - 1)}
                disabled={!hasPreviousPage || isLoading}
                className="gap-2"
            >
                <ChevronLeft className="h-4 w-4" />
                Previous
            </Button>

            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-600">
                    Page {page} of {totalPages}
                </span>
            </div>

            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page + 1)}
                disabled={!hasNextPage || isLoading}
                className="gap-2"
            >
                Next
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
}
