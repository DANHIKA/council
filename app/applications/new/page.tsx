"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileUpload, UploadedFile } from "@/components/file-upload";
import { GoogleIframeInput } from "@/components/google-iframe-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle, Upload, X, FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { applicationsApi, permitTypesApi } from "@/lib/services";
import type { PermitType, UploadedDocument } from "@/lib/types";
import { toast } from "sonner";

const applicationSchema = z.object({
    permitTypeId: z.string().min(1, "Please select a permit type"),
    description: z.string().min(10, "Description must be at least 10 characters"),
    location: z.string().min(3, "Location is required"),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

// Temporary interface for file pending upload
interface PendingFile {
    file: File;
    requirementId: string;
    id: string; // temp id
}

export default function NewApplicationPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [permitTypes, setPermitTypes] = useState<PermitType[]>([]);
    const [selectedPermitType, setSelectedPermitType] = useState<PermitType | null>(null);
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitStep, setSubmitStep] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // AI Recommendation states
    const [isRecommending, setIsRecommending] = useState(false);
    const [aiRecommendation, setAiRecommendation] = useState<{ recommendation: string; explanation: string } | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch,
        control,
    } = useForm<ApplicationFormData>({
        resolver: zodResolver(applicationSchema),
    });

    const watchedPermitTypeId = watch("permitTypeId") || "";
    const watchedDescription = watch("description") || "";

    const getAIRecommendation = async () => {
        if (watchedDescription.length < 10) {
            toast.error("Please provide at least 10 characters for a recommendation.");
            return;
        }

        setIsRecommending(true);
        setAiRecommendation(null);
        try {
            const res = await fetch("/api/ai/recommend-permit", {
                method: "POST",
                body: JSON.stringify({ description: watchedDescription }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setAiRecommendation(data);
            
            // Auto-select if a direct match is found
            const match = permitTypes.find(pt => pt.name.toLowerCase() === data.recommendation.toLowerCase());
            if (match) {
                setValue("permitTypeId", match.id);
                toast.success(`AI recommended: ${match.name}`);
            }
        } catch (err: any) {
            console.error("AI Recommendation failed:", err);
            toast.error("AI Recommendation failed. Please select manually.");
        } finally {
            setIsRecommending(false);
        }
    };

    useEffect(() => {
        if (status === "loading") return;
        if (!session) {
            router.push("/auth/login");
            return;
        }

        async function fetchPermitTypes() {
            try {
                const data = await permitTypesApi.list({ includeRequirements: true });
                setPermitTypes(data.permitTypes || []);
            } catch (err) {
                console.error("Failed to fetch permit types:", err);
                toast.error("Failed to load permit types");
            } finally {
                setLoading(false);
            }
        }
        fetchPermitTypes();
    }, [session, status, router]);

    useEffect(() => {
        const selected = permitTypes.find(pt => pt.id === watchedPermitTypeId);
        setSelectedPermitType(selected || null);
        // Clear pending files when switching types as requirements change
        setPendingFiles([]);
    }, [watchedPermitTypeId, permitTypes]);

    const handleFileSelect = async (files: File[], requirementId: string) => {
        if (!files.length) return;
        const file = files[0];
        // Add to pending files
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

    const allRequiredSatisfied = selectedPermitType?.requirements
        .filter(r => r.required)
        .every(r => getPendingFileForRequirement(r.id)) ?? false;

    const onSubmit = async (data: ApplicationFormData) => {
        if (!selectedPermitType) return;

        setSubmitting(true);
        setError(null);
        setSubmitStep("Creating application...");

        try {
            // 1. Create Application
            const createRes = await applicationsApi.create(data);
            const applicationId = createRes.application.id;

            // 2. Upload Documents
            setSubmitStep("Uploading documents...");
            const uploadPromises = pendingFiles.map(pending => {
                const formData = new FormData();
                formData.append("file", pending.file);
                formData.append("requirementId", pending.requirementId);
                return applicationsApi.documents.upload(applicationId, formData);
            });

            await Promise.all(uploadPromises);

            // 3. Submit Application
            setSubmitStep("Finalizing submission...");
            await applicationsApi.submit(applicationId);

            setSuccess(true);
            toast.success("Application submitted successfully!");
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Something went wrong during submission. Please try again.");
            toast.error("Submission failed");
        } finally {
            setSubmitting(false);
            setSubmitStep("");
        }
    };

    if (status === "loading" || loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (success) {
        return (
            <div className="container mx-auto py-8">
                <Card className="max-w-md mx-auto border-green-200 bg-green-50">
                    <CardContent className="p-8 text-center">
                        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-green-800 mb-2">Application Submitted!</h2>
                        <p className="text-green-700 mb-6">
                            Your permit application has been successfully submitted and is now under review.
                            You will be notified of any updates.
                        </p>
                        <div className="flex flex-col gap-3">
                            <Button asChild className="w-full bg-green-600 hover:bg-green-700">
                                <Link href="/dashboard">Return to Dashboard</Link>
                            </Button>
                            <Button asChild variant="outline" className="w-full border-green-200 text-green-700 hover:bg-green-100">
                                <Link href="/applications">View My Applications</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">New Permit Application</h1>
                <p className="text-muted-foreground">Fill in the details and upload required documents</p>
            </div>

            {error && (
                <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Application Details</CardTitle>
                        <CardDescription>Basic information about your permit request</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="permitTypeId">Permit Type *</Label>
                            <Controller
                                name="permitTypeId"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value || ""}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a permit type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {permitTypes.map(pt => (
                                                <SelectItem key={pt.id} value={pt.id}>
                                                    {pt.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.permitTypeId && (
                                <p className="text-sm text-destructive mt-1">{errors.permitTypeId.message}</p>
                            )}
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label htmlFor="description">Description *</Label>
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={getAIRecommendation}
                                    disabled={isRecommending || watchedDescription.length < 10}
                                    className="h-8 gap-2 text-xs border-primary/20 hover:border-primary"
                                >
                                    {isRecommending ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Sparkles className="h-3 w-3 text-primary" />
                                    )}
                                    Get AI Recommendation
                                </Button>
                            </div>
                            <Textarea
                                id="description"
                                placeholder="Provide a detailed description of your permit request"
                                {...register("description")}
                            />
                            {aiRecommendation && (
                                <div className="mt-2 p-3 bg-primary/5 border border-primary/10 rounded-md text-xs">
                                    <div className="flex items-center gap-2 font-semibold mb-1">
                                        <Sparkles className="h-3 w-3 text-primary" />
                                        <span>AI Suggestion: {aiRecommendation.recommendation}</span>
                                    </div>
                                    <p className="text-muted-foreground">{aiRecommendation.explanation}</p>
                                </div>
                            )}
                            {errors.description && (
                                <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="location">Location *</Label>
                            <Input
                                id="location"
                                placeholder="Physical address or location of the activity"
                                {...register("location")}
                            />
                            {errors.location && (
                                <p className="text-sm text-destructive mt-1">{errors.location.message}</p>
                            )}
                        </div>

                        <GoogleIframeInput
                            onLocationExtracted={(locationData) => {
                                setValue("latitude", locationData.latitude);
                                setValue("longitude", locationData.longitude);
                                if (locationData.address) {
                                    setValue("location", locationData.address);
                                }
                            }}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="latitude">Latitude (optional)</Label>
                                <Input
                                    id="latitude"
                                    type="number"
                                    step="any"
                                    placeholder="e.g. -26.2041"
                                    {...register("latitude", { valueAsNumber: true })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="longitude">Longitude (optional)</Label>
                                <Input
                                    id="longitude"
                                    type="number"
                                    step="any"
                                    placeholder="e.g. 28.0473"
                                    {...register("longitude", { valueAsNumber: true })}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {selectedPermitType && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Required Documents</CardTitle>
                            <CardDescription>
                                Upload the required documents for <strong>{selectedPermitType.name}</strong>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {selectedPermitType.requirements.map(req => {
                                const pendingFile = getPendingFileForRequirement(req.id);
                                const satisfied = !!pendingFile;
                                
                                return (
                                    <div key={req.id} className="space-y-3 p-4 border rounded-lg bg-slate-50/50">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Label className="text-base font-medium">
                                                    {req.label}
                                                    {req.required && <span className="text-destructive ml-1">*</span>}
                                                </Label>
                                                {req.required && (
                                                    <Badge variant={satisfied ? "default" : "outline"} className={satisfied ? "bg-green-600" : ""}>
                                                        {satisfied ? (
                                                            <><CheckCircle2 className="h-3 w-3 mr-1" /> Ready to Upload</>
                                                        ) : (
                                                            "Required"
                                                        )}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {req.description && (
                                            <p className="text-sm text-muted-foreground">{req.description}</p>
                                        )}
                                        
                                        {pendingFile ? (
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
                            })}
                        </CardContent>
                    </Card>
                )}

                <div className="flex justify-end gap-4">
                    <Button type="button" variant="outline" asChild>
                        <Link href="/dashboard">Cancel</Link>
                    </Button>
                    <Button 
                        type="submit" 
                        disabled={!selectedPermitType || !allRequiredSatisfied || submitting}
                        className="min-w-[150px]"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {submitStep || "Submitting..."}
                            </>
                        ) : (
                            "Submit Application"
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
