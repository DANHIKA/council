import { http } from "./http";

export const commentsApi = {
    create: (applicationId: string, content: string, isInternal = false) =>
        http.post<{ comment: any }>(`/api/applications/${applicationId}/comments`, {
            content,
            isInternal,
        }),
};
