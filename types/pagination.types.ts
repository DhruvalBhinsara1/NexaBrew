/**
 * Pagination types and interfaces for list operations
 */

export interface PaginationParams {
    page: number;
    limit: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
}

export interface PaginationState {
    page: number;
    limit: number;
    total: number;
}

/**
 * Validation schema for pagination params
 */
export function validatePaginationParams(page: number, limit: number) {
    const validatedPage = Math.max(1, Math.min(page, 999));
    const validatedLimit = Math.max(1, Math.min(limit, 100)); // Max 100 items per page
    return { page: validatedPage, limit: validatedLimit };
}
