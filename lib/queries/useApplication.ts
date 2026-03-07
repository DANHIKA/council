import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applicationsApi } from "@/lib/services";
import type { Application } from "@/lib/types";

export const useApplication = (id: string) => {
    return useQuery({
        queryKey: ["applications", id],
        queryFn: () => applicationsApi.get(id).then(res => res.application),
        enabled: !!id,
    });
};

export const useApplicationDocuments = (applicationId: string) => {
    return useQuery({
        queryKey: ["applications", applicationId, "documents"],
        queryFn: () => applicationsApi.documents.list(applicationId).then(res => res.documents),
        enabled: !!applicationId,
    });
};

export const useDeleteDocument = (applicationId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (documentId: string) => applicationsApi.documents.delete(applicationId, documentId),
        onSuccess: () => {
            // Invalidate specific application and its documents
            queryClient.invalidateQueries({ queryKey: ["applications", applicationId] });
            queryClient.invalidateQueries({ queryKey: ["applications", applicationId, "documents"] });
            // Invalidate all applications lists (document count might change)
            queryClient.invalidateQueries({ queryKey: ["applications"] });
            // Invalidate officer queue
            queryClient.invalidateQueries({ queryKey: ["officer", "queue"] });
            // Invalidate officer-specific application view
            queryClient.invalidateQueries({ queryKey: ["officer", "applications", applicationId] });
        },
    });
};

export const useCreateComment = (applicationId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ content, isInternal }: { content: string; isInternal?: boolean }) =>
            applicationsApi.comments.create(applicationId, content, isInternal),
        onSuccess: () => {
            // Invalidate specific application (comments appear there)
            queryClient.invalidateQueries({ queryKey: ["applications", applicationId] });
            // Invalidate officer-specific application view
            queryClient.invalidateQueries({ queryKey: ["officer", "applications", applicationId] });
        },
    });
};
