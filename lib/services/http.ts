import type { ApiResponse, ApiError } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export class HttpError extends Error {
    constructor(
        public status: number,
        message: string,
        public data?: any
    ) {
        super(message);
        this.name = "HttpError";
    }
}

export async function apiFetch<T = any>(
    url: string,
    options?: RequestInit & { skipAuth?: boolean }
): Promise<T> {
    const { skipAuth, ...fetchOptions } = options ?? {};

    const isFormData = fetchOptions.body instanceof FormData;

    const headers: HeadersInit = {
        ...(!isFormData && { "Content-Type": "application/json" }),
        ...fetchOptions.headers,
    };

    const res = await fetch(`${API_BASE}${url}`, {
        ...fetchOptions,
        headers,
        credentials: "same-origin",
    });

    if (!res.ok) {
        let errData: any;
        try {
            errData = await res.json();
        } catch {
            errData = { error: res.statusText };
        }
        throw new HttpError(res.status, errData.error || "Request failed", errData);
    }

    if (res.status === 204) {
        return null as T;
    }

    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
        return await res.json();
    } else {
        return (await res.blob()) as unknown as T;
    }
}

export const http = {
    get: <T>(url: string, options?: Omit<RequestInit, "method" | "body">) =>
        apiFetch<T>(url, { ...options, method: "GET" }),

    post: <T>(url: string, body?: any, options?: Omit<RequestInit, "method" | "body">) =>
        apiFetch<T>(url, {
            ...options,
            method: "POST",
            body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
        }),

    put: <T>(url: string, body?: any, options?: Omit<RequestInit, "method" | "body">) =>
        apiFetch<T>(url, {
            ...options,
            method: "PUT",
            body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
        }),

    patch: <T>(url: string, body?: any, options?: Omit<RequestInit, "method" | "body">) =>
        apiFetch<T>(url, {
            ...options,
            method: "PATCH",
            body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
        }),

    delete: <T>(url: string, options?: Omit<RequestInit, "method" | "body">) =>
        apiFetch<T>(url, { ...options, method: "DELETE" }),
};
