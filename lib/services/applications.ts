import { http } from "./http";
import type {
    Application,
    CreateApplicationRequest,
    UploadedDocument,
    PaginatedResponse,
} from "@/lib/types";

export const applicationsApi = {
    list: (params?: {
        status?: string;
        q?: string;
        page?: number;
        limit?: number;
    }) => {
        const search = new URLSearchParams();
        if (params?.status) search.set("status", params.status);
        if (params?.q) search.set("q", params.q);
        if (params?.page) search.set("page", params.page.toString());
        if (params?.limit) search.set("limit", params.limit.toString());
        const qs = search.toString();
        return http.get<PaginatedResponse<Application>>(`/api/applications${qs ? `?${qs}` : ""}`);
    },

    get: (id: string) => http.get<{ application: Application }>(`/api/applications/${id}`),

    create: (data: CreateApplicationRequest) =>
        http.post<{ application: Application }>("/api/applications", data),

    submit: (id: string) => http.post(`/api/applications/${id}/submit`),

    resubmit: (id: string) => http.post(`/api/applications/${id}/resubmit`),

    documents: {
        list: (applicationId: string) =>
            http.get<{ documents: UploadedDocument[] }>(`/api/applications/${applicationId}/documents`),

        upload: (applicationId: string, formData: FormData) =>
            http.post<{ document: UploadedDocument }>(
                `/api/applications/${applicationId}/documents`,
                formData,
                {
                    headers: {}, // let browser set multipart/form-data
                }
            ),

        delete: (applicationId: string, documentId: string) =>
            http.delete(`/api/applications/${applicationId}/documents/${documentId}`),
    },

    comments: {
        create: (applicationId: string, content: string, isInternal = false) =>
            http.post<{ comment: any }>(`/api/applications/${applicationId}/comments`, {
                content,
                isInternal,
            }),
    },

    certificate: {
        download: (applicationId: string) =>
            http.get(`/api/applications/${applicationId}/certificate/download`, {}),
    },
};
