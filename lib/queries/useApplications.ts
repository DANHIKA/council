import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applicationsApi } from "@/lib/services";
import type { Application, CreateApplicationRequest, PaginatedResponse } from "@/lib/types";

export const useApplications = (params?: {
    status?: string;
    q?: string;
    page?: number;
    limit?: number;
}) => {
    return useQuery({
        queryKey: ["applications", params],
        queryFn: () => applicationsApi.list(params),
        placeholderData: (prev) => prev,
    });
};

export const useCreateApplication = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateApplicationRequest) => applicationsApi.create(data),
        onSuccess: () => {
            // Invalidate all applications lists
            queryClient.invalidateQueries({ queryKey: ["applications"] });
            // Invalidate officer queue since new applications appear there
            queryClient.invalidateQueries({ queryKey: ["officer", "queue"] });
        },
    });
};

export const useSubmitApplication = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => applicationsApi.submit(id),
        onSuccess: (_, id) => {
            // Invalidate specific application
            queryClient.invalidateQueries({ queryKey: ["applications", id] });
            // Invalidate all applications lists
            queryClient.invalidateQueries({ queryKey: ["applications"] });
            // Invalidate officer queue (status changes)
            queryClient.invalidateQueries({ queryKey: ["officer", "queue"] });
            // Invalidate officer-specific application view
            queryClient.invalidateQueries({ queryKey: ["officer", "applications", id] });
        },
    });
};

export const useUploadDocument = (applicationId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (formData: FormData) => applicationsApi.documents.upload(applicationId, formData),
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
