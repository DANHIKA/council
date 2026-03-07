import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { officerApi } from "@/lib/services";
import type { Application } from "@/lib/types";

export const useOfficerQueue = (params?: {
    status?: string;
    q?: string;
    page?: number;
    limit?: number;
}) => {
    return useQuery({
        queryKey: ["officer", "queue", params],
        queryFn: () => officerApi.applications.list(params),
        placeholderData: (prev) => prev,
    });
};

export const useOfficerApplication = (id: string) => {
    return useQuery({
        queryKey: ["officer", "applications", id],
        queryFn: () => officerApi.applications.get(id).then(res => res.application),
        enabled: !!id,
    });
};

export const useAssignOfficer = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => officerApi.applications.assign(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ["officer", "applications", id] });
            queryClient.invalidateQueries({ queryKey: ["officer", "queue"] });
            queryClient.invalidateQueries({ queryKey: ["applications"] });
        },
    });
};

export const useApproveApplication = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, notes, internal }: {
            id: string;
            notes?: string;
            internal?: boolean;
        }) => officerApi.applications.decision(id, { decision: "APPROVE", notes, internal }),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ["officer", "applications", id] });
            queryClient.invalidateQueries({ queryKey: ["officer", "queue"] });
            queryClient.invalidateQueries({ queryKey: ["applications"] });
        },
    });
};

export const useRejectApplication = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, notes, internal }: {
            id: string;
            notes?: string;
            internal?: boolean;
        }) => officerApi.applications.decision(id, { decision: "REJECT", notes, internal }),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ["officer", "applications", id] });
            queryClient.invalidateQueries({ queryKey: ["officer", "queue"] });
            queryClient.invalidateQueries({ queryKey: ["applications"] });
        },
    });
};

export const useRequireCorrections = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, notes, internal }: {
            id: string;
            notes?: string;
            internal?: boolean;
        }) => officerApi.applications.decision(id, { decision: "REQUIRES_CORRECTION", notes, internal }),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ["officer", "applications", id] });
            queryClient.invalidateQueries({ queryKey: ["officer", "queue"] });
            queryClient.invalidateQueries({ queryKey: ["applications"] });
        },
    });
};
