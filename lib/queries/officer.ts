import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { officerApi } from "@/lib/services";
import type { Application, PaginatedResponse } from "@/lib/types";

export const officerQueryKeys = {
    applications: ["officer", "applications"],
    application: (id: string) => ["officer", "applications", id],
};

export const useOfficerApplications = (params?: {
    status?: string;
    q?: string;
    page?: number;
    limit?: number;
}) => {
    return useQuery({
        queryKey: [...officerQueryKeys.applications, params],
        queryFn: () => officerApi.applications.list(params),
        placeholderData: (prev) => prev,
    });
};

export const useOfficerApplication = (id: string) => {
    return useQuery({
        queryKey: officerQueryKeys.application(id),
        queryFn: () => officerApi.applications.get(id).then(res => res.application),
        enabled: !!id,
    });
};

export const useAssignOfficer = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => officerApi.applications.assign(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: officerQueryKeys.application(id) });
            queryClient.invalidateQueries({ queryKey: officerQueryKeys.applications });
        },
    });
};

export const useOfficerDecision = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: {
            id: string;
            payload: {
                decision: "APPROVE" | "REJECT" | "REQUIRES_CORRECTION";
                notes?: string;
                internal?: boolean;
            };
        }) => officerApi.applications.decision(id, payload),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: officerQueryKeys.application(id) });
            queryClient.invalidateQueries({ queryKey: officerQueryKeys.applications });
        },
    });
};
