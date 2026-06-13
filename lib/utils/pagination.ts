/**
 * Pagination utility functions
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Calculate offset from page number and limit
 */
export function calculateOffset(page: number, limit: number): number {
    return (Math.max(1, page) - 1) * limit;
}

/**
 * Calculate pagination metadata
 */
export function calculatePaginationMeta(
    page: number,
    limit: number,
    total: number
) {
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(limit, MAX_PAGE_SIZE));
    const totalPages = Math.ceil(total / validLimit);

    return {
        page: validPage,
        limit: validLimit,
        total,
        totalPages,
        hasNextPage: validPage < totalPages,
        hasPreviousPage: validPage > 1,
    };
}

/**
 * Parse pagination from URL search params
 */
export function parsePaginationParams(searchParams: URLSearchParams) {
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(
        1,
        Math.min(
            parseInt(searchParams.get("limit") || String(DEFAULT_PAGE_SIZE)),
            MAX_PAGE_SIZE
        )
    );

    return { page, limit };
}

/**
 * Create query string for pagination
 */
export function buildPaginationQuery(page: number, limit: number): string {
    return `page=${page}&limit=${limit}`;
}
