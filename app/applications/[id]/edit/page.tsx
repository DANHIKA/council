"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/file-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, ArrowLeft, X, FileText, Send, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { applicationsApi } from "@/lib/services";
import { useResubmitApplication } from "@/lib/queries";
import { getStatusColor, getStatusLabel, cn } from "@/lib/utils";
import type { Application, PermitType } from "@/lib/types";
import { toast } from "sonner";

interface PendingFile {
    file: File;
    requirementId: string;
    id: string;
}

export default function EditApplicationPage({ params }: { params: Promise<{ id: string }> }) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const queryClient = useQueryClient();

    const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
    const [permitType, setPermitType] = useState<PermitType | null>(null);
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [uploading, setUploading] = useState(false);

    const resubmitMutation = useResubmitApplication();

    useEffect(() => {
        (async () => {
            const p = await params;
            setResolvedParams(p);
        })();
    }, [params]);

    const { data: application, isLoading: appLoading, error: appError } = useQuery({
        queryKey: ["application", resolvedParams?.id],
        queryFn: () => applicationsApi.get(resolvedParams?.id || "").then(res => res.application),
        enabled: !!resolvedParams?.id,
    });

    const deleteDocumentMutation = useMutation({
        mutationFn: (documentId: string) =>
            applicationsApi.documents.delete(resolvedParams?.id || "", documentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["application", resolvedParams?.id] });
            toast.success("Document deleted");
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to delete document");
        },
    });

    useEffect(() => {
        if (!application?.permitTypeId) return;
        fetch("/api/permit-types?includeRequirements=true")
            .then(r => r.json())
            .then(data => {
                const found = (data.permitTypes || []).find(
                    (pt: PermitType) => pt.id === application.permitTypeId
                );
                setPermitType(found || null);
            })
            .catch(console.error);
    }, [application?.permitTypeId]);

    if (status === "loading" || appLoading || !resolvedParams) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!session) {
        router.push("/auth/login");
        return null;
    }

    if (appError || !application) {
        return (
            <div className="container mx-auto py-8 text-center">
                <p className="text-destructive mb-4">Failed to load application</p>
                <Button render={<Link href="/applications" />} variant="outline">
                    Back to Applications
                </Button>
            </div>
        );
    }

    const isEditable = ["SUBMITTED", "REQUIRES_CORRECTION"].includes(application.status);
    if (!isEditable) {
        return (
            <div className="container mx-auto py-8 max-w-4xl">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        This application cannot be edited in its current status ({getStatusLabel(application.status)}).
                    </AlertDescription>
                </Alert>
                <Button render={<Link href={`/applications/${application.id}`} />} variant="outline" className="mt-4">
                    View Application
                </Button>
            </div>
        );
    }

    const isCorrection = application.status === "REQUIRES_CORRECTION";

    const getExistingDocForRequirement = (reqId: string) =>
        application.documents.find(d => d.requirementId === reqId);

    const getPendingFileForRequirement = (reqId: string) =>
        pendingFiles.find(f => f.requirementId === reqId);

    const handleFileSelect = async (files: File[], requirementId: string) => {
        if (!files.length) return;
        setPendingFiles(prev => [
            ...prev.filter(f => f.requirementId !== requirementId),
            { file: files[0], requirementId, id: Math.random().toString(36).substring(7) },
        ]);
    };

    const handleRemovePendingFile = (tempId: string) =>
        setPendingFiles(prev => prev.filter(f => f.id !== tempId));

    const handleDeleteExisting = (docId: string) => {
        if (confirm("Delete this document?")) {
            deleteDocumentMutation.mutate(docId);
        }
    };

    const handleUploadAndResubmit = async () => {
        setUploading(true);
        try {
            if (pendingFiles.length > 0) {
                await Promise.all(
                    pendingFiles.map(pending => {
                        const formData = new FormData();
                        formData.append("file", pending.file);
                        formData.append("requirementId", pending.requirementId);
                        return applicationsApi.documents.upload(application.id, formData);
                    })
                );
                setPendingFiles([]);
                queryClient.invalidateQueries({ queryKey: ["application", application.id] });
            }

            if (isCorrection) {
                await resubmitMutation.mutateAsync(application.id);
                toast.success("Corrections submitted — your application is back under review.");
            } else {
                toast.success("Documents uploaded successfully.");
            }

            router.push(`/applications/${application.id}`);
        } catch (err: any) {
            toast.error(err.message || "Failed to save changes");
        } finally {
            setUploading(false);
        }
    };

    // Find correction-related comment (officer notes)
    const correctionNotes = application.comments
        ?.filter(c => !c.isInternal)
        .slice(-1)[0];

    return (
        <div className="container mx-auto py-12 max-w-3xl">
            <div className="flex items-center gap-4 mb-8">
                <Button variant="ghost" size="icon" render={<Link href={`/applications/${application.id}`} />} className="rounded-full h-10 w-10">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight">
                            {isCorrection ? "Submit Corrections" : "Edit Application"}
                        </h1>
                        <Badge className={getStatusColor(application.status)}>
                            {getStatusLabel(application.status)}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground font-medium">{application.permitType}</p>
                </div>
            </div>

            {isCorrection && correctionNotes && (
                <Alert className="mb-8 border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800 dark:text-orange-200">
                        <strong>Officer notes:</strong> {correctionNotes.content}
                    </AlertDescription>
                </Alert>
            )}

            <div className="space-y-12">
                <section className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-1 bg-primary rounded-full" />
                        <h2 className="text-xl font-semibold">Supporting Documents</h2>
                    </div>

                    <p className="text-sm text-muted-foreground px-1">
                        {isCorrection
                            ? "Upload corrected or missing documents, then submit your corrections for re-review."
                            : "Manage your application documents. Upload new files or replace existing ones."}
                    </p>

                    <div className="space-y-4 px-1">
                        {permitType ? (
                            permitType.requirements.map(req => {
                                const existingDoc = getExistingDocForRequirement(req.id);
                                const pendingFile = getPendingFileForRequirement(req.id);
                                const isSatisfied = !!existingDoc || !!pendingFile;
                                const isRejected = existingDoc?.status === "REJECTED";

                                return (
                                    <div
                                        key={req.id}
                                        className={cn(
                                            "group relative border rounded-2xl p-5 transition-all hover:border-primary/30 hover:shadow-sm bg-card/30",
                                            isRejected && "border-red-200 bg-red-50/30 dark:border-red-900 dark:bg-red-950/10"
                                        )}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-foreground">
                                                        {req.label}
                                                    </span>
                                                    {req.required && (
                                                        <Badge
                                                            variant={isSatisfied ? "default" : "outline"}
                                                            className={cn(
                                                                "text-[10px] uppercase tracking-wider h-5 px-1.5",
                                                                isRejected
                                                                    ? "bg-red-600 hover:bg-red-600 border-none"
                                                                    : isSatisfied
                                                                    ? "bg-green-600 hover:bg-green-600 border-none"
                                                                    : "text-muted-foreground"
                                                            )}
                                                        >
                                                            {isRejected ? "Rejected" : isSatisfied ? (existingDoc ? "Uploaded" : "Pending") : "Required"}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {req.description && (
                                                    <p className="text-xs text-muted-foreground max-w-md">{req.description}</p>
                                                )}
                                                {isRejected && existingDoc?.reviewNotes && (
                                                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                                                        Reason: {existingDoc.reviewNotes}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex-shrink-0">
                                                {existingDoc && !pendingFile ? (
                                                    <div className="flex items-center gap-3 bg-background border rounded-xl p-2 pr-1 shadow-sm">
                                                        <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center">
                                                            <FileText className="h-4 w-4 text-primary" />
                                                        </div>
                                                        <div className="min-w-0 flex-1 pr-2">
                                                            <p className="font-medium text-xs truncate max-w-[120px]">{existingDoc.name}</p>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {(existingDoc.fileSize / 1024).toFixed(1)} KB
                                                            </p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon-xs"
                                                            onClick={() => handleDeleteExisting(existingDoc.id)}
                                                            className="text-muted-foreground hover:text-destructive h-7 w-7"
                                                            title={isRejected ? "Replace rejected document" : "Delete document"}
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                ) : pendingFile ? (
                                                    <div className="flex items-center gap-3 bg-background border rounded-xl p-2 pr-1 shadow-sm animate-in zoom-in-95">
                                                        <div className="h-8 w-8 bg-green-500/10 rounded-lg flex items-center justify-center">
                                                            <FileText className="h-4 w-4 text-green-600" />
                                                        </div>
                                                        <div className="min-w-0 flex-1 pr-2">
                                                            <p className="font-medium text-xs truncate max-w-[120px]">{pendingFile.file.name}</p>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {(pendingFile.file.size / 1024).toFixed(1)} KB
                                                            </p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon-xs"
                                                            onClick={() => handleRemovePendingFile(pendingFile.id)}
                                                            className="text-muted-foreground hover:text-destructive h-7 w-7"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <FileUpload
                                                        onUpload={(files) => handleFileSelect(files, req.id)}
                                                        accept={req.acceptMime}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-12 border rounded-2xl border-dashed">
                                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/40" />
                                <p className="text-muted-foreground mt-4 font-medium">Loading requirements...</p>
                            </div>
                        )}
                    </div>
                </section>

                <div className="pt-10 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                    <Button
                        variant="ghost"
                        render={<Link href={`/applications/${application.id}`} />}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUploadAndResubmit}
                        disabled={uploading || resubmitMutation.isPending || (!pendingFiles.length && !isCorrection)}
                        className="w-full sm:w-auto h-11 px-8 text-base font-semibold shadow-lg shadow-primary/20"
                    >
                        {uploading || resubmitMutation.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {isCorrection ? "Submitting corrections..." : "Uploading..."}
                            </>
                        ) : isCorrection ? (
                            <>
                                <Send className="h-4 w-4 mr-2" />
                                Submit Corrections
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
