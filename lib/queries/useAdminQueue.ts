import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/services/http";

export const useAdminSignoffQueue = (params?: { q?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams({ status: "PENDING_APPROVAL" });
    if (params?.q) searchParams.set("q", params.q);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));

    return useQuery({
        queryKey: ["admin", "applications", "pending", params],
        queryFn: () => http.get<any>(`/api/admin/applications?${searchParams.toString()}`),
        placeholderData: (prev) => prev,
    });
};

export const useAdminSignoff = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, decision, notes }: { id: string; decision: "APPROVE" | "REJECT"; notes?: string }) =>
            http.post(`/api/admin/applications/${id}/signoff`, { decision, notes }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
            queryClient.invalidateQueries({ queryKey: ["officer", "queue"] });
            queryClient.invalidateQueries({ queryKey: ["applications"] });
        },
    });
};
