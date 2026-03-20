"use client";

import { useState, useEffect } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "@/components/file-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, X, FileText, CheckCircle2 } from "lucide-react";
import { applicationsApi, permitTypesApi } from "@/lib/services";
import type { PermitType } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const applicationSchema = z.object({
    permitTypeId: z.string().min(1, "Please select a permit type"),
    description: z.string().min(10, "Description must be at least 10 characters"),
    location: z.string().min(3, "Location is required"),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

interface PendingFile {
    file: File;
    requirementId: string;
    id: string;
}

interface NewApplicationSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    prefilledPermitTypeId?: string;
    prefilledDescription?: string;
}

export function NewApplicationSheet({ open, onOpenChange, onSuccess, prefilledPermitTypeId, prefilledDescription }: NewApplicationSheetProps) {
    const [permitTypes, setPermitTypes] = useState<PermitType[]>([]);
    const [selectedPermitType, setSelectedPermitType] = useState<PermitType | null>(null);
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [loadingTypes, setLoadingTypes] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const { register, handleSubmit, formState: { errors }, control, reset } =
        useForm<ApplicationFormData>({ resolver: zodResolver(applicationSchema) });

    const watchedPermitTypeId = useWatch({ control, name: "permitTypeId" }) || "";

    useEffect(() => {
        if (!open) return;
        setLoadingTypes(true);
        permitTypesApi.list({ includeRequirements: true })
            .then(data => setPermitTypes(data.permitTypes || []))
            .catch(() => toast.error("Failed to load permit types"))
            .finally(() => setLoadingTypes(false));
    }, [open]);

    useEffect(() => {
        if (!open) {
            reset();
            setPendingFiles([]);
            setSelectedPermitType(null);
            setError(null);
            setSuccess(false);
        } else {
            if (prefilledPermitTypeId) reset(r => ({ ...r, permitTypeId: prefilledPermitTypeId }));
            if (prefilledDescription) reset(r => ({ ...r, description: prefilledDescription }));
        }
    }, [open, reset, prefilledPermitTypeId, prefilledDescription]);

    useEffect(() => {
        const selected = permitTypes.find(pt => pt.id === watchedPermitTypeId);
        setSelectedPermitType(selected || null);
        setPendingFiles([]);
    }, [watchedPermitTypeId, permitTypes]);

    const handleFileSelect = (files: File[], requirementId: string) => {
        if (!files.length) return;
        setPendingFiles(prev => [...prev, { file: files[0], requirementId, id: Math.random().toString(36).slice(2) }]);
    };

    const getPendingFileForRequirement = (reqId: string) => pendingFiles.find(f => f.requirementId === reqId);

    const allRequiredSatisfied = selectedPermitType?.requirements
        .filter(r => r.required)
        .every(r => getPendingFileForRequirement(r.id)) ?? false;

    const onSubmit = async (data: ApplicationFormData) => {
        if (!selectedPermitType) return;
        setSubmitting(true);
        setError(null);
        try {
            const { application } = await applicationsApi.create(data);
            await Promise.all(pendingFiles.map(p => {
                const fd = new FormData();
                fd.append("file", p.file);
                fd.append("requirementId", p.requirementId);
                return applicationsApi.documents.upload(application.id, fd);
            }));
            await applicationsApi.submit(application.id);
            setSuccess(true);
            onSuccess?.();
        } catch (err: any) {
            setError(err.message || "Submission failed. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0" showCloseButton={!submitting}>
                <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                    <SheetTitle>New application</SheetTitle>
                </SheetHeader>

                {success ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
                        <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <CheckCircle2 className="h-7 w-7 text-green-600" />
                        </div>
                        <div>
                            <p className="font-semibold">Application submitted</p>
                            <p className="text-sm text-muted-foreground mt-1">You'll be notified of any updates.</p>
                        </div>
                        <Button onClick={() => onOpenChange(false)}>Done</Button>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto">
                        {loadingTypes ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-6 space-y-5">
                                {error && (
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="space-y-1.5">
                                    <Label>Permit type</Label>
                                    <Controller
                                        name="permitTypeId"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value || ""}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select permit type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {permitTypes.map(pt => (
                                                        <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.permitTypeId && <p className="text-xs text-destructive">{errors.permitTypeId.message}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <Label>Description</Label>
                                    <Textarea
                                        placeholder="Describe your permit request"
                                        className="min-h-[90px] resize-none"
                                        {...register("description")}
                                    />
                                    {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <Label>Location</Label>
                                    <Input placeholder="Where will this take place?" {...register("location")} />
                                    {errors.location && <p className="text-xs text-destructive">{errors.location.message}</p>}
                                </div>

                                {selectedPermitType && selectedPermitType.requirements.length > 0 && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-1">
                                        <Label>Documents</Label>
                                        {selectedPermitType.requirements.map(req => {
                                            const pending = getPendingFileForRequirement(req.id);
                                            return (
                                                <div key={req.id} className="border rounded-xl p-3 flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium truncate">{req.label}</span>
                                                            {req.required && !pending && (
                                                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground shrink-0">Required</Badge>
                                                            )}
                                                            {pending && (
                                                                <Badge className="text-[10px] h-4 px-1.5 bg-green-600 border-none shrink-0">Ready</Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0">
                                                        {pending ? (
                                                            <div className="flex items-center gap-1.5 border rounded-lg p-1 pr-0.5 bg-background">
                                                                <FileText className="h-3.5 w-3.5 text-primary ml-1" />
                                                                <span className="text-xs max-w-[80px] truncate">{pending.file.name}</span>
                                                                <Button type="button" variant="ghost" size="icon-xs" className="h-6 w-6 text-muted-foreground hover:text-destructive"
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
                                        })}
                                    </div>
                                )}

                                <div className="flex items-center justify-between pt-3 pb-2">
                                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={!selectedPermitType || !allRequiredSatisfied || submitting}>
                                        {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</> : "Submit"}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
