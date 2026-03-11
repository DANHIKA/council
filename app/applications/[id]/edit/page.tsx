"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/file-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, ArrowLeft, X, FileText } from "lucide-react";
import Link from "next/link";
import { applicationsApi } from "@/lib/services";
import { getStatusColor, getStatusLabel, cn } from "@/lib/utils";
import type { Application, PermitType, UploadedDocument } from "@/lib/types";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

// Temporary interface for file pending upload
interface PendingFile {
    file: File;
    requirementId: string;
    id: string; // temp id
}

export default function EditApplicationPage({ params }: { params: Promise<{ id: string }> }) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const queryClient = useQueryClient();
    
    const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
    const [permitTypes, setPermitTypes] = useState<PermitType[]>([]);
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [submitStep, setSubmitStep] = useState<string>("");

    useEffect(() => {
        (async () => {
            const p = await params;
            setResolvedParams(p);
        })();
    }, [params]);

    // Fetch Application
    const { data: application, isLoading: appLoading, error: appError } = useQuery({
        queryKey: ["application", resolvedParams?.id],
        queryFn: () => applicationsApi.get(resolvedParams?.id || "").then(res => res.application),
        enabled: !!resolvedParams?.id,
    });

    // Fetch Permit Types to get requirements
    useEffect(() => {
        if (!application?.permitTypeId) return;
        
        async function fetchPermitTypes() {
            try {
                const res = await fetch("/api/permit-types?includeRequirements=true");
                if (res.ok) {
                    const data = await res.json();
                    setPermitTypes(data.permitTypes || []);
                }
            } catch (err) {
                console.error("Failed to fetch permit types:", err);
            }
        }
        fetchPermitTypes();
    }, [application?.permitTypeId]);

    const deleteDocumentMutation = useMutation({
        mutationFn: (documentId: string) => 
            applicationsApi.documents.delete(resolvedParams?.id || "", documentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["application", resolvedParams?.id] });
            toast.success("Document deleted");
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to delete document");
        }
    });

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

    // Check if editable
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

    const permitType = permitTypes.find(pt => pt.id === application.permitTypeId);
    
    // Helper to check if a requirement is satisfied by an existing document
    const getExistingDocForRequirement = (reqId: string) => {
        // We need to match by requirement ID (which we have in permitType.requirements)
        // But application.documents might store requirementId or have requirement object
        return application.documents.find(d => d.requirementId === reqId);
    };

    const handleFileSelect = async (files: File[], requirementId: string) => {
        if (!files.length) return;
        const file = files[0];
        setPendingFiles(prev => [
            ...prev,
            { file, requirementId, id: Math.random().toString(36).substring(7) }
        ]);
    };

    const handleRemovePendingFile = (tempId: string) => {
        setPendingFiles(prev => prev.filter(f => f.id !== tempId));
    };

    const getPendingFileForRequirement = (reqId: string) => {
        return pendingFiles.find(f => f.requirementId === reqId);
    };

    const handleDeleteExisting = (docId: string) => {
        if (confirm("Are you sure you want to delete this document?")) {
            deleteDocumentMutation.mutate(docId);
        }
    };

    const handleSaveChanges = async () => {
        if (!pendingFiles.length && application.status === "SUBMITTED") {
            // Nothing to upload, just go back
            router.push(`/applications/${application.id}`);
            return;
        }

        setSubmitting(true);
        setSubmitStep("Uploading documents...");

        try {
            // Upload pending files
            const uploadPromises = pendingFiles.map(pending => {
                const formData = new FormData();
                formData.append("file", pending.file);
                formData.append("requirementId", pending.requirementId);
                return applicationsApi.documents.upload(application.id, formData);
            });

            await Promise.all(uploadPromises);
            
            // If status was REQUIRES_CORRECTION, we might want to "Resubmit" or just leave it.
            // The original flow had a separate "submit" step. 
            // If we are just adding docs, we might not need to change status unless we want to signal "Corrections Submitted".
            // For now, we'll just upload and invalidate.
            
            // If it was REQUIRES_CORRECTION, maybe we should trigger a status update to SUBMITTED or similar?
            // The backend submit route handles SUBMITTED -> UNDER_REVIEW.
            // But for corrections, we might need a specific "resubmit" action or just notify the officer.
            // Let's keep it simple: just upload.

            setPendingFiles([]);
            queryClient.invalidateQueries({ queryKey: ["application", application.id] });
            toast.success("Documents uploaded successfully");
            
            // Navigate back
            router.push(`/applications/${application.id}`);
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to upload documents");
        } finally {
            setSubmitting(false);
            setSubmitStep("");
        }
    };

    return (
        <div className="container mx-auto py-12 max-w-3xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" render={<Link href={`/applications/${application.id}`} />} className="rounded-full h-10 w-10">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight">Edit Application</h1>
                            <Badge className={getStatusColor(application.status)}>
                                {getStatusLabel(application.status)}
                            </Badge>
                        </div>
                        <p className="text-muted-foreground font-medium">{application.permitType}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-12">
                {/* Section: Documents */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-1 bg-primary rounded-full" />
                        <h2 className="text-xl font-semibold">Supporting Documents</h2>
                    </div>
                    
                    <p className="text-sm text-muted-foreground px-1">
                        Manage your application documents. You can upload new files or replace existing ones.
                    </p>

                    <div className="space-y-4 px-1">
                        {permitType ? (
                            permitType.requirements.map(req => {
                                const existingDoc = getExistingDocForRequirement(req.id);
                                const pendingFile = getPendingFileForRequirement(req.id);
                                const isSatisfied = !!existingDoc || !!pendingFile;

                                return (
                                    <div key={req.id} className="group relative border rounded-2xl p-5 transition-all hover:border-primary/30 hover:shadow-sm bg-card/30">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-foreground">
                                                        {req.label}
                                                    </span>
                                                    {req.required && (
                                                        <Badge variant={isSatisfied ? "default" : "outline"} 
                                                            className={cn(
                                                                "text-[10px] uppercase tracking-wider h-5 px-1.5",
                                                                isSatisfied ? "bg-green-600 hover:bg-green-600 border-none" : "text-muted-foreground"
                                                            )}
                                                        >
                                                            {isSatisfied ? (existingDoc ? "Uploaded" : "Pending Upload") : "Required"}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {req.description && (
                                                    <p className="text-xs text-muted-foreground max-w-md">{req.description}</p>
                                                )}
                                            </div>

                                            <div className="flex-shrink-0">
                                                {existingDoc ? (
                                                    <div className="flex items-center gap-3 bg-background border rounded-xl p-2 pr-1 shadow-sm">
                                                        <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center">
                                                            <FileText className="h-4 w-4 text-primary" />
                                                        </div>
                                                        <div className="min-w-0 flex-1 pr-2">
                                                            <p className="font-medium text-xs truncate max-w-[120px]">{existingDoc.name}</p>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    {(existingDoc.fileSize / 1024).toFixed(1)} KB
                                                                </p>
                                                                {existingDoc.status === "REJECTED" && (
                                                                    <span className="text-[10px] text-red-500 font-bold uppercase tracking-tighter">Rejected</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Button 
                                                            type="button" 
                                                            variant="ghost" 
                                                            size="icon-xs"
                                                            onClick={() => handleDeleteExisting(existingDoc.id)}
                                                            className="text-muted-foreground hover:text-destructive h-7 w-7"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                ) : pendingFile ? (
                                                    <div className="flex items-center gap-3 bg-background border rounded-xl p-2 pr-1 shadow-sm animate-in zoom-in-95">
                                                        <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center">
                                                            <FileText className="h-4 w-4 text-primary" />
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
                                                    <div className="w-full sm:w-auto">
                                                        <FileUpload
                                                            onUpload={(files) => handleFileSelect(files, req.id)}
                                                            accept={req.acceptMime}
                                                        />
                                                    </div>
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

                {/* Footer Actions */}
                <div className="pt-10 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                    <Button variant="ghost" render={<Link href={`/applications/${application.id}`} />} className="text-muted-foreground hover:text-foreground">
                        Cancel Changes
                    </Button>
                    <Button 
                        onClick={handleSaveChanges} 
                        disabled={submitting || (!pendingFiles.length && application.status !== "REQUIRES_CORRECTION")}
                        className="w-full sm:w-[200px] h-11 text-base font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {submitStep || "Uploading..."}
                            </>
                        ) : (
                            "Save Changes"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
