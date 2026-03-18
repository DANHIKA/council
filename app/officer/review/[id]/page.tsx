"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { UploadedFile } from "@/components/file-upload";
import { formatDateTime, getStatusColor, getStatusLabel } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, Sparkles, Loader2, Clock, User } from "lucide-react";
import Link from "next/link";
import {
    useOfficerApplication,
    useAssignOfficer,
    useApproveApplication,
    useRejectApplication,
    useRequireCorrections,
    useCreateComment,
} from "@/lib/queries";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";

const TIMELINE_COLORS: Record<string, string> = {
    APPROVED: "bg-green-500",
    REJECTED: "bg-red-500",
    UNDER_REVIEW: "bg-yellow-500",
    REQUIRES_CORRECTION: "bg-orange-500",
    SUBMITTED: "bg-blue-500",
};

export default function OfficerReviewPage({ params }: { params: Promise<{ id: string }> }) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
    const [decisionNotes, setDecisionNotes] = useState("");
    const [internalNotes, setInternalNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [aiSummary, setAiSummary] = useState<string | null>(null);

    const { isStaff, isAdmin } = usePermissions();
    const userRole = (session?.user as any)?.role;

    const { data: application, isLoading, error } = useOfficerApplication(resolvedParams?.id || "");

    const assignMutation = useAssignOfficer();
    const approveMutation = useApproveApplication();
    const rejectMutation = useRejectApplication();
    const correctionsMutation = useRequireCorrections();
    const commentMutation = useCreateComment(resolvedParams?.id || "");

    useEffect(() => {
        if (status === "loading") return;
        if (!session || !isStaff) {
            router.push("/dashboard");
            return;
        }
        (async () => {
            const p = await params;
            setResolvedParams(p);
        })();
    }, [status, session, isStaff, router, params]);

    if (status === "loading" || !resolvedParams) return null;
    if (!session || !isStaff) return null;

    if (isLoading) {
        return (
            <div className="container mx-auto py-8 max-w-5xl">
                <div className="flex items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <p>Loading application...</p>
                </div>
            </div>
        );
    }

    if (error || !application) {
        return (
            <div className="container mx-auto py-8 max-w-5xl">
                <div className="rounded-md bg-destructive/15 p-4 text-destructive flex items-center gap-3 mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm font-medium">Failed to load application details.</p>
                </div>
                <Button variant="outline" className="mt-4" render={<Link href="/officer/applications" />}>
                    Back to Queue
                </Button>
            </div>
        );
    }

    const handleSummarize = async () => {
        setIsSummarizing(true);
        setAiSummary(null);
        try {
            const res = await fetch("/api/ai/summarize-application", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ applicationId: application.id }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setAiSummary(data.summary);
            toast.success("AI summary generated");
        } catch {
            toast.error("AI summarize failed");
        } finally {
            setIsSummarizing(false);
        }
    };

    const handleAssign = async () => {
        try {
            await assignMutation.mutateAsync(application.id);
            toast.success("Application assigned to you");
        } catch (err: any) {
            toast.error(err.message || "Failed to assign");
        }
    };

    const handleDecision = async (decision: "APPROVE" | "REJECT" | "REQUIRES_CORRECTION") => {
        if (!decisionNotes.trim()) {
            toast.error("Please provide decision notes");
            return;
        }
        setIsSubmitting(true);
        try {
            const payload = { id: application.id, notes: decisionNotes };
            if (decision === "APPROVE") await approveMutation.mutateAsync(payload);
            else if (decision === "REJECT") await rejectMutation.mutateAsync(payload);
            else await correctionsMutation.mutateAsync(payload);

            if (internalNotes.trim()) {
                await commentMutation.mutateAsync({ content: internalNotes, isInternal: true });
            }

            const labels: Record<string, string> = {
                APPROVE: "approved",
                REJECT: "rejected",
                REQUIRES_CORRECTION: "sent back for corrections",
            };
            toast.success(`Application ${labels[decision]}`);
            router.push("/officer/applications");
        } catch (err: any) {
            toast.error(err.message || "Failed to submit decision");
        } finally {
            setIsSubmitting(false);
        }
    };

    const canDecide =
        application.officer?.id === (session?.user as any)?.id || isAdmin;
    const isAssigned = !!application.officer;
    const isFinal = ["APPROVED", "REJECTED"].includes(application.status);
    const isAwaitingCorrections = application.status === "REQUIRES_CORRECTION";

    // Last public comment (officer notes to applicant)
    const lastOfficerNote = application.comments
        ?.filter((c: any) => !c.isInternal)
        .slice(-1)[0];

    return (
        <div className="container mx-auto py-8 max-w-5xl space-y-8">
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    render={<Link href="/officer/applications" />}
                    className="rounded-full h-10 w-10"
                >
                    <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">Review Application</h1>
                    <p className="text-muted-foreground">{application.permitType}</p>
                </div>
                <Badge className={getStatusColor(application.status)}>
                    {getStatusLabel(application.status)}
                </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Application Details */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle>Application Details</CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSummarize}
                                disabled={isSummarizing}
                                className="h-8 gap-2 text-xs border-primary/20 hover:border-primary"
                            >
                                {isSummarizing ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Sparkles className="h-3 w-3 text-primary" />
                                )}
                                AI Summarize
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {aiSummary && (
                                <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg text-sm">
                                    <div className="flex items-center gap-2 font-semibold mb-1">
                                        <Sparkles className="h-3 w-3 text-primary" />
                                        AI Briefing Note
                                    </div>
                                    <p className="text-muted-foreground whitespace-pre-line">{aiSummary}</p>
                                </div>
                            )}
                            <div>
                                <Label>Description</Label>
                                <p className="mt-1 text-sm">{application.description}</p>
                            </div>
                            <div>
                                <Label>Location</Label>
                                <p className="mt-1 text-sm">{application.location}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Applicant</Label>
                                    <p className="mt-1 text-sm font-medium">{application.applicant.name}</p>
                                    <p className="text-xs text-muted-foreground">{application.applicant.email}</p>
                                </div>
                                <div>
                                    <Label>Submitted</Label>
                                    <p className="mt-1 text-sm">{formatDateTime(application.createdAt)}</p>
                                </div>
                            </div>
                            {isAssigned && (
                                <div>
                                    <Label>Assigned Officer</Label>
                                    <p className="mt-1 text-sm flex items-center gap-2">
                                        <User className="h-3 w-3 text-muted-foreground" />
                                        {application.officer?.name}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Documents */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Documents</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {application.documents.length === 0 ? (
                                <p className="text-muted-foreground text-center py-4">No documents uploaded</p>
                            ) : (
                                <div className="space-y-3">
                                    {application.documents.map((doc: any) => (
                                        <UploadedFile key={doc.id} file={doc} showStatus />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Comments */}
                    {application.comments?.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Comments</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {application.comments.map((comment: any) => (
                                    <div key={comment.id} className="border-l-2 border-muted pl-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-sm">{comment.author.name}</span>
                                            {comment.isInternal && (
                                                <Badge variant="secondary" className="text-xs">Internal</Badge>
                                            )}
                                            <span className="text-xs text-muted-foreground">
                                                {formatDateTime(comment.createdAt)}
                                            </span>
                                        </div>
                                        <p className="text-sm">{comment.content}</p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Timeline */}
                    {application.timeline?.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    Timeline
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {[...application.timeline].reverse().map((event: any) => (
                                        <div key={event.id} className="flex gap-3">
                                            <div className="mt-1.5 flex-shrink-0">
                                                <div
                                                    className={`w-2.5 h-2.5 rounded-full ${TIMELINE_COLORS[event.status] ?? "bg-muted-foreground"}`}
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0 pb-4 border-b border-muted last:border-0 last:pb-0">
                                                <p className="font-medium text-sm">{event.event}</p>
                                                {event.description && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                                                )}
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {formatDateTime(event.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right column */}
                <div className="space-y-6">
                    {/* Awaiting corrections notice */}
                    {isAwaitingCorrections && lastOfficerNote && (
                        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-orange-800 dark:text-orange-200 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" />
                                    Correction Requested
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-orange-700 dark:text-orange-300">{lastOfficerNote.content}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Assign card */}
                    {!isAssigned && !isFinal && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Assign Application</CardTitle>
                                <CardDescription>Take ownership to begin review</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    onClick={handleAssign}
                                    disabled={assignMutation.isPending}
                                    className="w-full"
                                >
                                    {assignMutation.isPending ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Assigning...</>
                                    ) : (
                                        "Assign to Me"
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Decision card — shown when assigned and not final */}
                    {isAssigned && !isFinal && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Decision</CardTitle>
                                <CardDescription>
                                    {isAwaitingCorrections
                                        ? "Applicant has resubmitted — make a new decision"
                                        : "Submit your decision for this application"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="decisionNotes">
                                        Decision Notes <span className="text-destructive">*</span>
                                    </Label>
                                    <Textarea
                                        id="decisionNotes"
                                        placeholder={
                                            isAwaitingCorrections
                                                ? "Describe what further action is needed, or approve/reject..."
                                                : "Provide detailed notes for your decision..."
                                        }
                                        value={decisionNotes}
                                        onChange={e => setDecisionNotes(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="internalNotes">Internal Notes (optional)</Label>
                                    <Textarea
                                        id="internalNotes"
                                        placeholder="Visible to staff only..."
                                        value={internalNotes}
                                        onChange={e => setInternalNotes(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                                <Separator />
                                <div className="space-y-2">
                                    <Button
                                        onClick={() => handleDecision("APPROVE")}
                                        disabled={!canDecide || isSubmitting}
                                        className="w-full bg-green-600 hover:bg-green-700"
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Approve
                                    </Button>
                                    <Button
                                        onClick={() => handleDecision("REQUIRES_CORRECTION")}
                                        disabled={!canDecide || isSubmitting}
                                        variant="outline"
                                        className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                                    >
                                        <AlertCircle className="h-4 w-4 mr-2" />
                                        Require Corrections
                                    </Button>
                                    <Button
                                        onClick={() => handleDecision("REJECT")}
                                        disabled={!canDecide || isSubmitting}
                                        variant="destructive"
                                        className="w-full"
                                    >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Reject
                                    </Button>
                                </div>
                                {!canDecide && (
                                    <p className="text-xs text-muted-foreground text-center">
                                        Assigned to a different officer
                                    </p>
                                )}
                                {isSubmitting && (
                                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Submitting...
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Final decision */}
                    {isFinal && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Final Decision</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Badge className={getStatusColor(application.status)}>
                                    {getStatusLabel(application.status)}
                                </Badge>
                                {application.certificate && (
                                    <div className="pt-2 space-y-1 text-sm">
                                        <p className="font-medium">Certificate Issued</p>
                                        <p className="text-muted-foreground font-mono text-xs">
                                            {application.certificate.certificateNo}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Valid until: {formatDateTime(application.certificate.expiryDate)}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
