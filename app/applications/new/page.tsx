"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "@/components/file-upload";
import { VoiceInput } from "@/components/voice-input";
import { GoogleIframeInput } from "@/components/google-iframe-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle, X, FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { applicationsApi, permitTypesApi } from "@/lib/services";
import type { PermitType, UploadedDocument } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

    const watchedPermitTypeId = useWatch({ control, name: "permitTypeId" }) || "";
    const watchedDescription = useWatch({ control, name: "description" }) || "";

    const getAIRecommendation = async () => {
        const descriptionValue = watch("description") || "";
        if (descriptionValue.length < 10) {
            toast.error("Please provide at least 10 characters for a recommendation.");
            return;
        }

        setIsRecommending(true);
        setAiRecommendation(null);
        try {
            const res = await fetch("/api/ai/recommend-permit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description: descriptionValue }),
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
            <div className="container mx-auto py-24 max-w-md text-center">
                <div className="mb-8 flex justify-center">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center animate-in zoom-in-50 duration-500">
                        <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                    </div>
                </div>
                <h2 className="text-3xl font-bold tracking-tight mb-3">Application Submitted!</h2>
                <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
                    Your permit application has been successfully submitted and is now under review.
                    You will be notified of any updates.
                </p>
                <div className="flex flex-col gap-3">
                    <Button render={<Link href="/dashboard" />} size="lg" className="w-full bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20">
                        Return to Dashboard
                    </Button>
                    <Button render={<Link href="/applications" />} variant="ghost" size="lg" className="w-full text-muted-foreground hover:text-foreground">
                        View My Applications
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-12 max-w-3xl">
            <div className="mb-10 text-center">
                <h1 className="text-3xl font-bold tracking-tight mb-2">New Permit Application</h1>
                <p className="text-muted-foreground text-lg">Complete the form below to submit your permit request.</p>
            </div>

            {error && (
                <Alert variant="destructive" className="mb-8 border-destructive/50 bg-destructive/5">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
                {/* Section: Basic Information */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-1 bg-primary rounded-full" />
                        <h2 className="text-xl font-semibold">Basic Information</h2>
                    </div>
                    
                    <div className="grid gap-6 p-1">
                        <div className="space-y-2">
                            <Label htmlFor="permitTypeId" className="text-sm font-medium">Permit Type <span className="text-destructive">*</span></Label>
                            <Controller
                                name="permitTypeId"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value || ""}>
                                        <SelectTrigger className="h-11 bg-background/50 focus:bg-background transition-colors">
                                            <SelectValue placeholder="What type of permit do you need?" />
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
                                <p className="text-sm text-destructive font-medium">{errors.permitTypeId.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="description" className="text-sm font-medium">Description <span className="text-destructive">*</span></Label>
                                <div className="flex items-center gap-2">
                                    <VoiceInput 
                                        onTranscript={(transcript) => {
                                            const currentVal = watch("description") || "";
                                            setValue("description", currentVal ? `${currentVal} ${transcript}` : transcript);
                                        }}
                                    />
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={getAIRecommendation}
                                        disabled={isRecommending || watchedDescription.length < 10}
                                        className="h-8 gap-2 text-xs text-primary hover:text-primary hover:bg-primary/5 font-medium"
                                    >
                                        {isRecommending ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <Sparkles className="h-3 w-3" />
                                        )}
                                        AI Assist
                                    </Button>
                                </div>
                            </div>
                            <Textarea
                                id="description"
                                placeholder="Tell us more about your permit request (min. 10 characters)..."
                                className="min-h-[120px] bg-background/50 focus:bg-background transition-colors resize-none"
                                {...register("description")}
                            />
                            {aiRecommendation && (
                                <div className="mt-2 p-4 bg-primary/5 border border-primary/10 rounded-xl text-sm animate-in fade-in slide-in-from-top-1">
                                    <div className="flex items-center gap-2 font-semibold text-primary mb-1.5">
                                        <Sparkles className="h-4 w-4" />
                                        <span>AI Suggestion: {aiRecommendation.recommendation}</span>
                                    </div>
                                    <p className="text-muted-foreground leading-relaxed">{aiRecommendation.explanation}</p>
                                </div>
                            )}
                            {errors.description && (
                                <p className="text-sm text-destructive font-medium">{errors.description.message}</p>
                            )}
                        </div>
                    </div>
                </section>

                {/* Section: Location */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-1 bg-primary rounded-full" />
                        <h2 className="text-xl font-semibold">Location Details</h2>
                    </div>

                    <div className="grid gap-6 p-1">
                        <div className="space-y-2">
                            <Label htmlFor="location" className="text-sm font-medium">Physical Address <span className="text-destructive">*</span></Label>
                            <Input
                                id="location"
                                placeholder="Where will the activity take place?"
                                className="h-11 bg-background/50 focus:bg-background transition-colors"
                                {...register("location")}
                            />
                            {errors.location && (
                                <p className="text-sm text-destructive font-medium">{errors.location.message}</p>
                            )}
                        </div>

                        <div className="pt-2">
                            <GoogleIframeInput
                                onLocationExtracted={(locationData) => {
                                    setValue("latitude", locationData.latitude);
                                    setValue("longitude", locationData.longitude);
                                    if (locationData.address) {
                                        setValue("location", locationData.address);
                                    }
                                }}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                                <Label htmlFor="latitude" className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Latitude</Label>
                                <Input
                                    id="latitude"
                                    type="number"
                                    step="any"
                                    placeholder="e.g. -26.2041"
                                    className="bg-background/50 focus:bg-background transition-colors"
                                    {...register("latitude", { valueAsNumber: true })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="longitude" className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Longitude</Label>
                                <Input
                                    id="longitude"
                                    type="number"
                                    step="any"
                                    placeholder="e.g. 28.0473"
                                    className="bg-background/50 focus:bg-background transition-colors"
                                    {...register("longitude", { valueAsNumber: true })}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section: Documents */}
                {selectedPermitType && (
                    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-8 w-1 bg-primary rounded-full" />
                            <h2 className="text-xl font-semibold">Supporting Documents</h2>
                        </div>
                        
                        <p className="text-sm text-muted-foreground px-1">
                            Please upload the following required documents for your <strong>{selectedPermitType.name}</strong> application.
                        </p>

                        <div className="space-y-4 px-1">
                            {selectedPermitType.requirements.map(req => {
                                const pendingFile = getPendingFileForRequirement(req.id);
                                const satisfied = !!pendingFile;
                                
                                return (
                                    <div key={req.id} className="group relative border rounded-2xl p-5 transition-all hover:border-primary/30 hover:shadow-sm bg-card/30">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-foreground">
                                                        {req.label}
                                                    </span>
                                                    {req.required && (
                                                        <Badge variant={satisfied ? "default" : "outline"} 
                                                            className={cn(
                                                                "text-[10px] uppercase tracking-wider h-5 px-1.5",
                                                                satisfied ? "bg-green-600 hover:bg-green-600 border-none" : "text-muted-foreground"
                                                            )}
                                                        >
                                                            {satisfied ? "Uploaded" : "Required"}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {req.description && (
                                                    <p className="text-xs text-muted-foreground max-w-md">{req.description}</p>
                                                )}
                                            </div>
                                            
                                            <div className="flex-shrink-0">
                                                {pendingFile ? (
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
                            })}
                        </div>
                    </section>
                )}

                {/* Footer Actions */}
                <div className="pt-10 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                    <Button type="button" variant="ghost" render={<Link href="/dashboard" />} className="text-muted-foreground hover:text-foreground">
                        Cancel Application
                    </Button>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        {!allRequiredSatisfied && selectedPermitType && (
                            <span className="text-xs text-muted-foreground hidden md:inline-block mr-2">
                                Please upload all required documents
                            </span>
                        )}
                        <Button 
                            type="submit" 
                            disabled={!selectedPermitType || !allRequiredSatisfied || submitting}
                            className="w-full sm:w-[200px] h-11 text-base font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
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
                </div>
            </form>
        </div>
    );
}
