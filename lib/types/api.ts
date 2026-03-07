export interface ApiResponse<T = any> {
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface CreateApplicationRequest {
    permitTypeId: string;
    description: string;
    location: string;
    latitude?: number;
    longitude?: number;
}

export interface UploadDocumentRequest {
    requirementId?: string;
}

export interface ValidationError {
    field: string;
    message: string;
    code: string;
}

export interface ApiError {
    error: string | ValidationError[];
}
