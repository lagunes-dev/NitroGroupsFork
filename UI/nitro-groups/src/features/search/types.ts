export interface GroupSearchItem {
    id: number;
    slug: string;
    groupName: string;
    description: string;
    locationText: string;
    currency: string;
    basePrice: number | null;
    hourlyRate: number | null;
    minimumDurationHours: number;
    numMembers: number;
    imageUrl: string | null;
    genres: string[];
    averageRating: number;
    totalReviews: number;
    isVerified: boolean;
}

export interface PagedResult<T> {
    items: T[];
    pageNumber: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

export interface GenreOption {
    id: number;
    name: string;
    slug: string;
}

/** Filtros de la búsqueda, tal como viajan en la URL (/groups?genero=...). */
export interface SearchFilters {
    q?: string;
    genero?: string;
    ciudad?: string;
    presupuesto?: string;
    fecha?: string;
    pagina?: string;
    /** Id of a group left out of the list: the one that just rejected this date (T41). */
    excluir?: string;
}
