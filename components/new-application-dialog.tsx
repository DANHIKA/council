"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, PenLine, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { NewApplicationSheet } from "@/components/new-application-sheet";
import { permitTypesApi } from "@/lib/services";
import type { PermitType } from "@/lib/types";

interface NewApplicationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

type Step = "choose" | "ai" | "ai-result";

export function NewApplicationDialog({ open, onOpenChange, onSuccess }: NewApplicationDialogProps) {
    const [step, setStep] = useState<Step>("choose");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [recommendation, setRecommendation] = useState<{ name: string; explanation: string; id: string } | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [prefilledPermitTypeId, setPrefilledPermitTypeId] = useState<string | undefined>();
    const [prefilledDescription, setPrefilledDescription] = useState<string | undefined>();

    const reset = () => {
        setStep("choose");
        setDescription("");
        setRecommendation(null);
        setLoading(false);
    };

    const handleClose = (val: boolean) => {
        if (!val) reset();
        onOpenChange(val);
    };

    const handleAskAI = async () => {
        if (description.trim().length < 10) {
            toast.error("Please describe your project in a bit more detail");
            return;
        }
        setLoading(true);
        try {
            const [res, typesData] = await Promise.all([
                fetch("/api/ai/recommend-permit", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ description: description.trim() }),
                }),
                permitTypesApi.list({ includeRequirements: false }),
            ]);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "AI failed");

            const permitTypes: PermitType[] = typesData.permitTypes || [];
            const match = permitTypes.find(pt =>
                pt.name.toLowerCase() === data.recommendation.toLowerCase()
            );

            setRecommendation({
                name: data.recommendation,
                explanation: data.explanation,
                id: match?.id ?? "",
            });
            setStep("ai-result");
        } catch {
            toast.error("Could not get a recommendation. Try again or pick manually.");
        } finally {
            setLoading(false);
        }
    };

    const openSheet = (permitTypeId?: string, desc?: string) => {
        setPrefilledPermitTypeId(permitTypeId);
        setPrefilledDescription(desc);
        onOpenChange(false);
        reset();
        // slight delay so dialog closes before sheet opens
        setTimeout(() => setSheetOpen(true), 100);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent className="max-w-sm" showCloseButton>
                    <DialogHeader>
                        <DialogTitle>New application</DialogTitle>
                    </DialogHeader>

                    {step === "choose" && (
                        <div className="space-y-3 pt-1">
                            <button
                                onClick={() => setStep("ai")}
                                className="w-full text-left border rounded-xl p-4 hover:border-primary hover:bg-primary/5 transition-colors group"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                                        <Sparkles className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">Let AI help me</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Describe your project and AI will suggest the right permit type</p>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => openSheet()}
                                className="w-full text-left border rounded-xl p-4 hover:border-primary hover:bg-primary/5 transition-colors group"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-muted/80 transition-colors">
                                        <PenLine className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">I know what I need</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Pick a permit type and fill in the details yourself</p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}

                    {step === "ai" && (
                        <div className="space-y-4 pt-1">
                            <p className="text-sm text-muted-foreground">What are you trying to do? Describe your project or activity.</p>
                            <Textarea
                                placeholder="e.g. I want to open a small restaurant in the city centre…"
                                className="min-h-[110px] resize-none"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                autoFocus
                            />
                            <div className="flex items-center justify-between">
                                <Button variant="ghost" size="sm" onClick={() => setStep("choose")} className="text-muted-foreground">
                                    Back
                                </Button>
                                <Button onClick={handleAskAI} disabled={loading || description.trim().length < 10}>
                                    {loading
                                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Thinking…</>
                                        : <><Sparkles className="h-4 w-4 mr-2" />Recommend</>
                                    }
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === "ai-result" && recommendation && (
                        <div className="space-y-4 pt-1">
                            <div className="border rounded-xl p-4 bg-primary/5 border-primary/20 space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-primary shrink-0" />
                                    <p className="font-semibold text-sm">{recommendation.name}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">{recommendation.explanation}</p>
                            </div>

                            <div className="flex items-center justify-between">
                                <Button variant="ghost" size="sm" onClick={() => setStep("ai")} className="text-muted-foreground">
                                    Try again
                                </Button>
                                <Button onClick={() => openSheet(recommendation.id || undefined, description)}>
                                    Continue
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <NewApplicationSheet
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                onSuccess={onSuccess}
                prefilledPermitTypeId={prefilledPermitTypeId}
                prefilledDescription={prefilledDescription}
            />
        </>
    );
}
