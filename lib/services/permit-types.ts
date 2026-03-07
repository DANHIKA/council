import { http } from "./http";
import type { PermitType } from "@/lib/types";

export const permitTypesApi = {
    list: (params?: { includeRequirements?: boolean }) => {
        const query = params?.includeRequirements ? "?includeRequirements=true" : "";
        return http.get<{ permitTypes: PermitType[] }>(`/api/permit-types${query}`);
    },
};
