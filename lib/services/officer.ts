import { http } from "./http";
import type { Application, PaginatedResponse } from "@/lib/types";

export const officerApi = {
    applications: {
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
            return http.get<PaginatedResponse<Application>>(`/api/officer/applications${qs ? `?${qs}` : ""}`);
        },

        get: (id: string) => http.get<{ application: Application }>(`/api/officer/applications/${id}`),

        assign: (id: string) => http.post<{ application: Application }>(`/api/officer/applications/${id}/assign`),

        decision: (id: string, payload: {
            decision: "APPROVE" | "REJECT" | "REQUIRES_CORRECTION";
            notes?: string;
            internal?: boolean;
        }) => http.post<{ application: Application }>(`/api/officer/applications/${id}/decision`, payload),
    },
};
