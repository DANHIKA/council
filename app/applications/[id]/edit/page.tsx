"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileUpload, UploadedFile } from "@/components/file-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft, X, FileText } from "lucide-react";
import Link from "next/link";
import { applicationsApi } from "@/lib/services";
import { getStatusColor, getStatusLabel } from "@/lib/utils";
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
                <Button asChild variant="outline">
                    <Link href="/applications">Back to Applications</Link>
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
                <Button asChild variant="outline" className="mt-4">
                    <Link href={`/applications/${application.id}`}>View Application</Link>
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
        <div className="container mx-auto py-8 max-w-4xl space-y-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href={`/applications/${application.id}`}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Edit Application</h1>
                    <p className="text-muted-foreground">{application.permitType}</p>
                </div>
                <Badge className={getStatusColor(application.status)}>
                    {getStatusLabel(application.status)}
                </Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Documents</CardTitle>
                    <CardDescription>
                        Manage documents for your application.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {permitType ? (
                        permitType.requirements.map(req => {
                            const existingDoc = getExistingDocForRequirement(req.id);
                            const pendingFile = getPendingFileForRequirement(req.id);
                            const isSatisfied = !!existingDoc || !!pendingFile;

                            return (
                                <div key={req.id} className="space-y-3 p-4 border rounded-lg bg-slate-50/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Label className="text-base font-medium">
                                                {req.label}
                                                {req.required && <span className="text-destructive ml-1">*</span>}
                                            </Label>
                                            <Badge variant={isSatisfied ? "default" : "secondary"} className={isSatisfied ? "bg-green-600" : ""}>
                                                {existingDoc ? "Uploaded" : pendingFile ? "Pending Upload" : "Required"}
                                            </Badge>
                                        </div>
                                    </div>

                                    {req.description && (
                                        <p className="text-sm text-muted-foreground">{req.description}</p>
                                    )}

                                    {existingDoc ? (
                                        <div className="flex items-center justify-between p-3 bg-white border rounded-md">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center">
                                                    <FileText className="h-5 w-5 text-slate-500" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm truncate max-w-[200px]">{existingDoc.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {(existingDoc.fileSize / 1024).toFixed(1)} KB
                                                    </p>
                                                    {existingDoc.status === "REJECTED" && (
                                                        <p className="text-xs text-red-500 font-medium">Rejected</p>
                                                    )}
                                                </div>
                                            </div>
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon"
                                                onClick={() => handleDeleteExisting(existingDoc.id)}
                                                className="text-muted-foreground hover:text-destructive"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : pendingFile ? (
                                        <div className="flex items-center justify-between p-3 bg-white border rounded-md">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center">
                                                    <FileText className="h-5 w-5 text-slate-500" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm truncate max-w-[200px]">{pendingFile.file.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {(pendingFile.file.size / 1024).toFixed(1)} KB
                                                    </p>
                                                </div>
                                            </div>
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon"
                                                onClick={() => handleRemovePendingFile(pendingFile.id)}
                                                className="text-muted-foreground hover:text-destructive"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <FileUpload
                                            onUpload={(files) => handleFileSelect(files, req.id)}
                                            accept={req.acceptMime}
                                        />
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                            <p className="text-muted-foreground mt-2">Loading requirements...</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
                <Button variant="outline" asChild>
                    <Link href={`/applications/${application.id}`}>Cancel</Link>
                </Button>
                <Button 
                    onClick={handleSaveChanges} 
                    disabled={submitting || (!pendingFiles.length && application.status !== "REQUIRES_CORRECTION")}
                >
                    {submitting ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {submitStep}
                        </>
                    ) : (
                        "Save Changes"
                    )}
                </Button>
            </div>
        </div>
    );
}
