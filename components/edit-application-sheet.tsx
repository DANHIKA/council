"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "@/components/file-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, X, FileText, Send, CheckCircle2 } from "lucide-react";
import { applicationsApi } from "@/lib/services";
import { useResubmitApplication } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { PermitType } from "@/lib/types";
import { toast } from "sonner";

interface PendingFile {
    file: File;
    requirementId: string;
    id: string;
}

interface EditApplicationSheetProps {
    applicationId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function EditApplicationSheet({ applicationId, open, onOpenChange, onSuccess }: EditApplicationSheetProps) {
    const queryClient = useQueryClient();
    const [permitType, setPermitType] = useState<PermitType | null>(null);
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [uploading, setUploading] = useState(false);

    const resubmitMutation = useResubmitApplication();

    const { data: application, isLoading } = useQuery({
        queryKey: ["application", applicationId],
        queryFn: () => applicationsApi.get(applicationId).then(r => r.application),
        enabled: open && !!applicationId,
    });

    const deleteDocMutation = useMutation({
        mutationFn: (docId: string) => applicationsApi.documents.delete(applicationId, docId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
            toast.success("Document removed");
        },
        onError: (err: any) => toast.error(err.message || "Failed to remove document"),
    });

    useEffect(() => {
        if (!open) { setPendingFiles([]); return; }
    }, [open]);

    useEffect(() => {
        if (!application?.permitTypeId) return;
        fetch("/api/permit-types?includeRequirements=true")
            .then(r => r.json())
            .then(data => {
                const found = (data.permitTypes || []).find((pt: PermitType) => pt.id === application.permitTypeId);
                setPermitType(found || null);
            })
            .catch(console.error);
    }, [application?.permitTypeId]);

    const getPendingFile = (reqId: string) => pendingFiles.find(f => f.requirementId === reqId);
    const getExistingDoc = (reqId: string) => application?.documents.find(d => d.requirementId === reqId);

    const handleFileSelect = (files: File[], requirementId: string) => {
        if (!files.length) return;
        setPendingFiles(prev => [
            ...prev.filter(f => f.requirementId !== requirementId),
            { file: files[0], requirementId, id: Math.random().toString(36).slice(2) },
        ]);
    };

    const handleSave = async () => {
        if (!application) return;
        const isCorrection = application.status === "REQUIRES_CORRECTION";
        setUploading(true);
        try {
            if (pendingFiles.length > 0) {
                await Promise.all(pendingFiles.map(p => {
                    const fd = new FormData();
                    fd.append("file", p.file);
                    fd.append("requirementId", p.requirementId);
                    return applicationsApi.documents.upload(application.id, fd);
                }));
                setPendingFiles([]);
                queryClient.invalidateQueries({ queryKey: ["application", application.id] });
            }
            if (isCorrection) {
                await resubmitMutation.mutateAsync(application.id);
                toast.success("Corrections submitted — back under review.");
            } else {
                toast.success("Documents uploaded.");
            }
            onSuccess?.();
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err.message || "Failed to save changes");
        } finally {
            setUploading(false);
        }
    };

    const isCorrection = application?.status === "REQUIRES_CORRECTION";
    const correctionNote = application?.comments?.filter((c: any) => !c.isInternal).slice(-1)[0];
    const canSave = uploading || resubmitMutation.isPending
        ? false
        : pendingFiles.length > 0 || isCorrection;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-xl flex flex-col p-0"
                showCloseButton={!uploading}
            >
                <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                    <SheetTitle>
                        {isCorrection ? "Submit corrections" : "Add documents"}
                    </SheetTitle>
                </SheetHeader>

                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : !application ? (
                    <div className="flex-1 flex items-center justify-center p-6 text-center">
                        <p className="text-sm text-muted-foreground">Application not found.</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto">
                        <div className="px-6 py-6 space-y-6">
                            {isCorrection && correctionNote && (
                                <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
                                    <AlertCircle className="h-4 w-4 text-orange-600" />
                                    <AlertDescription className="text-orange-800 dark:text-orange-200">
                                        <strong>Officer notes: </strong>{correctionNote.content}
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-3">
                                {permitType ? permitType.requirements.map(req => {
                                    const existing = getExistingDoc(req.id);
                                    const pending = getPendingFile(req.id);
                                    const satisfied = !!existing || !!pending;
                                    const isRejected = existing?.status === "REJECTED";

                                    return (
                                        <div
                                            key={req.id}
                                            className={cn(
                                                "border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                                                isRejected && "border-red-200 bg-red-50/30 dark:border-red-900 dark:bg-red-950/10"
                                            )}
                                        >
                                            <div className="space-y-0.5 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium">{req.label}</span>
                                                    {req.required && (
                                                        <Badge
                                                            variant={satisfied ? "default" : "outline"}
                                                            className={cn(
                                                                "text-[10px] h-4 px-1.5",
                                                                isRejected ? "bg-red-600 border-none"
                                                                    : satisfied ? "bg-green-600 border-none"
                                                                    : "text-muted-foreground"
                                                            )}
                                                        >
                                                            {isRejected ? "Rejected" : satisfied ? (existing ? "Uploaded" : "Pending") : "Required"}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {req.description && <p className="text-xs text-muted-foreground">{req.description}</p>}
                                                {isRejected && existing?.reviewNotes && (
                                                    <p className="text-xs text-red-600 dark:text-red-400">Reason: {existing.reviewNotes}</p>
                                                )}
                                            </div>

                                            <div className="shrink-0">
                                                {existing && !pending ? (
                                                    <div className="flex items-center gap-2 border rounded-lg p-1.5 pr-1 bg-background">
                                                        <div className="h-7 w-7 bg-primary/10 rounded-md flex items-center justify-center">
                                                            <FileText className="h-3.5 w-3.5 text-primary" />
                                                        </div>
                                                        <span className="text-xs font-medium max-w-[100px] truncate">{existing.name}</span>
                                                        <Button type="button" variant="ghost" size="icon-xs"
                                                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                            onClick={() => deleteDocMutation.mutate(existing.id)}>
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ) : pending ? (
                                                    <div className="flex items-center gap-2 border rounded-lg p-1.5 pr-1 bg-background">
                                                        <div className="h-7 w-7 bg-green-500/10 rounded-md flex items-center justify-center">
                                                            <FileText className="h-3.5 w-3.5 text-green-600" />
                                                        </div>
                                                        <span className="text-xs font-medium max-w-[100px] truncate">{pending.file.name}</span>
                                                        <Button type="button" variant="ghost" size="icon-xs"
                                                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                            onClick={() => setPendingFiles(p => p.filter(f => f.id !== pending.id))}>
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <FileUpload onUpload={async (files) => handleFileSelect(files, req.id)} accept={req.acceptMime} />
                                                )}
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="py-10 text-center border rounded-xl border-dashed">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground mt-3">Loading requirements…</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between pt-2 pb-4">
                                <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">
                                    Cancel
                                </Button>
                                <Button onClick={handleSave} disabled={!canSave}>
                                    {uploading || resubmitMutation.isPending ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isCorrection ? "Submitting…" : "Uploading…"}</>
                                    ) : isCorrection ? (
                                        <><Send className="h-4 w-4 mr-2" />Submit corrections</>
                                    ) : (
                                        <><CheckCircle2 className="h-4 w-4 mr-2" />Save changes</>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
