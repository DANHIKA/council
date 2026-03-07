import { http } from "./http";

export const certificatesApi = {
    download: (applicationId: string) =>
        http.get(`/api/applications/${applicationId}/certificate/download`, {}),
};
