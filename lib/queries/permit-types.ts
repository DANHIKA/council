import { useQuery } from "@tanstack/react-query";
import { permitTypesApi } from "@/lib/services";
import type { PermitType } from "@/lib/types";

export const permitTypesQueryKeys = {
    all: ["permit-types"],
};

export const usePermitTypes = () => {
    return useQuery({
        queryKey: permitTypesQueryKeys.all,
        queryFn: () => permitTypesApi.list().then(res => res.permitTypes),
    });
};
