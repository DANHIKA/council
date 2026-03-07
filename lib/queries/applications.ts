import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applicationsApi } from "@/lib/services";
import type { Application, CreateApplicationRequest, PaginatedResponse } from "@/lib/types";

export const queryKeys = {
    applications: ["applications"],
    application: (id: string) => ["applications", id],
    applicationDocuments: (id: string) => ["applications", id, "documents"],
    applicationComments: (id: string) => ["applications", id, "comments"],
};

export const useApplications = (params?: {
    status?: string;
    q?: string;
    page?: number;
    limit?: number;
}) => {
    return useQuery({
        queryKey: [...queryKeys.applications, params],
        queryFn: () => applicationsApi.list(params),
        placeholderData: (prev) => prev,
    });
};

export const useApplication = (id: string) => {
    return useQuery({
        queryKey: queryKeys.application(id),
        queryFn: () => applicationsApi.get(id).then(res => res.application),
        enabled: !!id,
    });
};

export const useCreateApplication = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateApplicationRequest) => applicationsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.applications });
        },
    });
};

export const useSubmitApplication = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => applicationsApi.submit(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.application(id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.applications });
        },
    });
};

export const useApplicationDocuments = (applicationId: string) => {
    return useQuery({
        queryKey: queryKeys.applicationDocuments(applicationId),
        queryFn: () => applicationsApi.documents.list(applicationId).then(res => res.documents),
        enabled: !!applicationId,
    });
};

export const useUploadDocument = (applicationId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (formData: FormData) => applicationsApi.documents.upload(applicationId, formData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.applicationDocuments(applicationId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.application(applicationId) });
        },
    });
};

export const useDeleteDocument = (applicationId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (documentId: string) => applicationsApi.documents.delete(applicationId, documentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.applicationDocuments(applicationId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.application(applicationId) });
        },
    });
};

export const useCreateComment = (applicationId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ content, isInternal }: { content: string; isInternal?: boolean }) =>
            applicationsApi.comments.create(applicationId, content, isInternal),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.application(applicationId) });
        },
    });
};

export const useDownloadCertificate = (applicationId: string) => {
    return useMutation({
        mutationFn: () => applicationsApi.certificate.download(applicationId),
    });
};
