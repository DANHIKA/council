"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { UploadedFile } from "@/components/file-upload";
import { formatDateTime, getStatusColor, getStatusLabel } from "@/lib/utils";
import {
    ArrowLeft, CheckCircle2, XCircle, AlertCircle, Sparkles,
    Loader2, Clock, User, Check, X, MapPin, Calendar,
    FileText, ShieldCheck, ChevronDown, ChevronUp,
} from "lucide-react";
import Link from "next/link";
import {
    useOfficerApplication,
    useAssignOfficer,
    useApproveApplication,
    useRejectApplication,
    useRequireCorrections,
} from "@/lib/queries";
import { usePermissions } from "@/hooks/usePermissions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
    APPROVED: "bg-green-500",
    REJECTED: "bg-red-500",
    UNDER_REVIEW: "bg-yellow-500",
    REQUIRES_CORRECTION: "bg-orange-500",
    SUBMITTED: "bg-blue-500",
    PENDING_APPROVAL: "bg-purple-500",
};

// ─── Officer action panel ──────────────────────────────────────────────────────
function OfficerPanel({
    application,
    session,
    canDecide,
    isAssigned,
    isFinal,
}: {
    application: any;
    session: any;
    canDecide: boolean;
    isAssigned: boolean;
    isFinal: boolean;
}) {
    const router = useRouter();
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const assignMutation = useAssignOfficer();
    const approveMutation = useApproveApplication();
    const rejectMutation = useRejectApplication();
    const correctionsMutation = useRequireCorrections();

    const handleAssign = async () => {
        try {
            await assignMutation.mutateAsync(application.id);
            toast.success("Application assigned to you");
        } catch (err: any) {
            toast.error(err.message || "Failed to assign");
        }
    };

    const handleDecision = async (decision: "APPROVE" | "REJECT" | "REQUIRES_CORRECTION") => {
        if (!notes.trim()) { toast.error("Notes are required"); return; }
        setSubmitting(true);
        try {
            const payload = { id: application.id, notes };
            if (decision === "APPROVE") await approveMutation.mutateAsync(payload);
            else if (decision === "REJECT") await rejectMutation.mutateAsync(payload);
            else await correctionsMutation.mutateAsync(payload);
            toast.success(decision === "APPROVE" ? "Recommended for approval" : decision === "REJECT" ? "Application rejected" : "Corrections requested");
            router.push("/officer/applications");
        } catch (err: any) {
            toast.error(err.message || "Failed to submit");
        } finally {
            setSubmitting(false);
        }
    };

    if (isFinal) return null;

    return (
        <div className="space-y-3">
            {!isAssigned && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Claim Application</CardTitle>
                        <CardDescription className="text-xs">Assign it to yourself to begin review</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleAssign} disabled={assignMutation.isPending} className="w-full" size="sm">
                            {assignMutation.isPending
                                ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Assigning...</>
                                : "Assign to Me"}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {isAssigned && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Your Recommendation</CardTitle>
                        <CardDescription className="text-xs">
                            {application.status === "REQUIRES_CORRECTION"
                                ? "Applicant has resubmitted — review and decide"
                                : "Approval recommendations go to admin for final sign-off"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label className="text-xs">Notes <span className="text-destructive">*</span></Label>
                            <Textarea
                                placeholder="Provide reasoning for your decision..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="mt-1.5 min-h-[90px] text-sm resize-none"
                            />
                        </div>
                        {!canDecide && (
                            <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 text-center">
                                Assigned to a different officer
                            </p>
                        )}
                        <div className="space-y-2">
                            <Button
                                onClick={() => handleDecision("APPROVE")}
                                disabled={!canDecide || submitting}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                                size="sm"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                                Recommend Approval
                            </Button>
                            <Button
                                onClick={() => handleDecision("REQUIRES_CORRECTION")}
                                disabled={!canDecide || submitting}
                                variant="outline"
                                size="sm"
                                className="w-full border-orange-300 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                            >
                                <AlertCircle className="h-3.5 w-3.5 mr-2" />
                                Request Corrections
                            </Button>
                            <Button
                                onClick={() => handleDecision("REJECT")}
                                disabled={!canDecide || submitting}
                                variant="destructive"
                                size="sm"
                                className="w-full"
                            >
                                <XCircle className="h-3.5 w-3.5 mr-2" />
                                Reject
                            </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground text-center leading-snug">
                            "Recommend Approval" sends this to an admin for final sign-off
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ─── Admin action panel ────────────────────────────────────────────────────────
function AdminPanel({
    application,
    session,
}: {
    application: any;
    session: any;
}) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const approveMutation = useApproveApplication();
    const rejectMutation = useRejectApplication();
    const correctionsMutation = useRequireCorrections();

    const isFinal = ["APPROVED", "REJECTED"].includes(application.status);
    const isPendingApproval = application.status === "PENDING_APPROVAL";
    const isUnderReview = ["UNDER_REVIEW", "REQUIRES_CORRECTION", "SUBMITTED"].includes(application.status);

    const handleOfficerDecision = async (decision: "APPROVE" | "REJECT" | "REQUIRES_CORRECTION") => {
        if (!notes.trim()) { toast.error("Notes are required"); return; }
        setSubmitting(true);
        try {
            const payload = { id: application.id, notes };
            if (decision === "APPROVE") await approveMutation.mutateAsync(payload);
            else if (decision === "REJECT") await rejectMutation.mutateAsync(payload);
            else await correctionsMutation.mutateAsync(payload);
            toast.success("Decision submitted");
            router.refresh();
        } catch (err: any) {
            toast.error(err.message || "Failed");
        } finally {
            setSubmitting(false);
        }
    };

    const handleFinalSignoff = async (decision: "APPROVE" | "REJECT") => {
        if (!notes.trim()) { toast.error("Notes are required for the final decision"); return; }
        setSubmitting(true);
        try {
            const res = await fetch(`/api/admin/applications/${application.id}/signoff`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ decision, notes }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");
            toast.success(decision === "APPROVE" ? "Application approved — certificate generated" : "Application rejected");
            queryClient.invalidateQueries({ queryKey: ["officer", "applications", application.id] });
            router.push("/officer/applications");
        } catch (err: any) {
            toast.error(err.message || "Failed to submit decision");
        } finally {
            setSubmitting(false);
        }
    };

    if (isFinal) return null;

    return (
        <div className="space-y-3">
            {/* Final sign-off — shown only when PENDING_APPROVAL */}
            {isPendingApproval && (
                <Card className="border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-green-700 dark:text-green-400" />
                            <CardTitle className="text-sm text-green-800 dark:text-green-300">Final Sign-off</CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                            {application.officer
                                ? `Officer ${application.officer.name} has recommended approval`
                                : "This application is awaiting admin sign-off"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label className="text-xs">Decision notes <span className="text-destructive">*</span></Label>
                            <Textarea
                                placeholder="Add notes for this final decision..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="mt-1.5 min-h-[80px] text-sm resize-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                onClick={() => handleFinalSignoff("APPROVE")}
                                disabled={submitting}
                                size="sm"
                                className="w-full bg-green-600 hover:bg-green-700 text-white"
                            >
                                <Check className="h-3.5 w-3.5 mr-1.5" />
                                Approve
                            </Button>
                            <Button
                                onClick={() => handleFinalSignoff("REJECT")}
                                disabled={submitting}
                                size="sm"
                                variant="outline"
                                className="w-full border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                                <X className="h-3.5 w-3.5 mr-1.5" />
                                Reject
                            </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground text-center">
                            Approval generates the permit certificate immediately
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Admin officer-level controls — shown during active review */}
            {isUnderReview && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Admin Review</CardTitle>
                        <CardDescription className="text-xs">
                            You can act on any application. Recommending approval sends it for sign-off.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label className="text-xs">Notes <span className="text-destructive">*</span></Label>
                            <Textarea
                                placeholder="Add notes for your decision..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="mt-1.5 min-h-[80px] text-sm resize-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <Button
                                onClick={() => handleOfficerDecision("APPROVE")}
                                disabled={submitting}
                                size="sm"
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                                Recommend Approval
                            </Button>
                            <Button
                                onClick={() => handleOfficerDecision("REQUIRES_CORRECTION")}
                                disabled={submitting}
                                variant="outline"
                                size="sm"
                                className="w-full border-orange-300 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                            >
                                <AlertCircle className="h-3.5 w-3.5 mr-2" />
                                Request Corrections
                            </Button>
                            <Button
                                onClick={() => handleOfficerDecision("REJECT")}
                                disabled={submitting}
                                variant="destructive"
                                size="sm"
                                className="w-full"
                            >
                                <XCircle className="h-3.5 w-3.5 mr-2" />
                                Reject
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function OfficerReviewPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const id = params?.id ?? "";

    const [showHistory, setShowHistory] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [reviewingDocId, setReviewingDocId] = useState<string | null>(null);
    const [docReviewNotes, setDocReviewNotes] = useState("");

    const { isStaff, isAdmin, role } = usePermissions();
    const { data: application, isLoading, error } = useOfficerApplication(id);

    useEffect(() => {
        if (status === "loading") return;
        if (!session || !isStaff) router.push("/dashboard");
    }, [status, session, isStaff, router]);

    if (status === "loading" || !session || !isStaff) return null;

    if (isLoading) {
        return (
            <div className="container mx-auto py-12 max-w-5xl flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading application...</span>
            </div>
        );
    }

    if (error || !application) {
        return (
            <div className="container mx-auto py-8 max-w-5xl space-y-4">
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 flex items-center gap-3">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <p className="text-sm text-destructive">Failed to load application.</p>
                </div>
                <Button variant="outline" size="sm" render={<Link href="/officer/applications" />}>Back to Queue</Button>
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
        } catch {
            toast.error("AI summarize failed");
        } finally {
            setIsSummarizing(false);
        }
    };

    const handleDocReview = async (docId: string, docStatus: "APPROVED" | "REJECTED") => {
        try {
            const res = await fetch(`/api/applications/${application.id}/documents/${docId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: docStatus, reviewNotes: docReviewNotes || undefined }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");
            toast.success(`Document ${docStatus.toLowerCase()}`);
            setReviewingDocId(null);
            setDocReviewNotes("");
            router.refresh();
        } catch (err: any) {
            toast.error(err.message || "Failed to review document");
        }
    };

    const canDecide = application.officer?.id === (session?.user as any)?.id || isAdmin;
    const isAssigned = !!application.officer;
    const isFinal = (["APPROVED", "REJECTED"] as string[]).includes(application.status);
    const isPendingApproval = (application.status as string) === "PENDING_APPROVAL";

    // Merged activity feed (timeline + comments)
    const activityItems = [
        ...(application.timeline ?? []).map((e: any) => ({
            id: e.id, type: "timeline" as const,
            date: e.createdAt, label: e.event,
            detail: e.description, status: e.status,
        })),
        ...(application.comments ?? []).map((c: any) => ({
            id: c.id, type: "comment" as const,
            date: c.createdAt, label: c.author.name,
            detail: c.content, isInternal: c.isInternal,
        })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="container mx-auto py-6 max-w-5xl space-y-6">

            {/* ── Header ── */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" render={<Link href="/officer/applications" />} className="rounded-full h-9 w-9 shrink-0">
                    <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                </Button>
                <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{application.permitType}</p>
                    <p className="text-xs text-muted-foreground">{application.applicant?.name} · {formatDateTime(application.createdAt)}</p>
                </div>
                <Badge className={`shrink-0 ${getStatusColor(application.status)}`}>
                    {getStatusLabel(application.status)}
                </Badge>
                <Badge variant="outline" className="shrink-0 text-xs font-normal hidden sm:flex">
                    {isAdmin ? "Admin" : "Officer"}
                </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ── Left column ── */}
                <div className="lg:col-span-2 space-y-4">

                    {/* Application info */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                            <CardTitle className="text-sm font-semibold">Application Details</CardTitle>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSummarize}
                                disabled={isSummarizing}
                                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-primary px-2"
                            >
                                {isSummarizing
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <Sparkles className="h-3 w-3" />}
                                AI Summarize
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {aiSummary && (
                                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-sm">
                                    <p className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1.5">
                                        <Sparkles className="h-3 w-3" /> AI Briefing Note
                                    </p>
                                    <p className="text-muted-foreground whitespace-pre-line leading-relaxed">{aiSummary}</p>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                                <div className="col-span-2">
                                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><FileText className="h-3 w-3" />Description</p>
                                    <p className="leading-relaxed">{application.description}</p>
                                </div>
                                {application.location && (
                                    <div className="col-span-2">
                                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="h-3 w-3" />Location</p>
                                        <p>{application.location}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><User className="h-3 w-3" />Applicant</p>
                                    <p className="font-medium">{application.applicant?.name}</p>
                                    <p className="text-xs text-muted-foreground">{application.applicant?.email}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="h-3 w-3" />Submitted</p>
                                    <p>{formatDateTime(application.createdAt)}</p>
                                </div>
                                {isAssigned && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Reviewing Officer</p>
                                        <p className="font-medium">{application.officer?.name}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Documents */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold">
                                Documents
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    {application.documents?.length ?? 0} file{application.documents?.length !== 1 ? "s" : ""}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!application.documents?.length ? (
                                <p className="text-sm text-muted-foreground text-center py-6">No documents uploaded</p>
                            ) : (
                                <div className="space-y-3">
                                    {application.documents.map((doc: any) => (
                                        <div key={doc.id}>
                                            <UploadedFile file={doc} showStatus />
                                            {!isAdmin && doc.status === "PENDING" && reviewingDocId !== doc.id && (
                                                <div className="flex items-center gap-2 mt-1.5 ml-1">
                                                    <button
                                                        className="text-xs text-green-700 hover:text-green-800 flex items-center gap-0.5"
                                                        onClick={() => setReviewingDocId(doc.id)}
                                                    >
                                                        <Check className="h-3 w-3" /> Approve
                                                    </button>
                                                    <span className="text-muted-foreground/40">·</span>
                                                    <button
                                                        className="text-xs text-red-600 hover:text-red-700 flex items-center gap-0.5"
                                                        onClick={() => setReviewingDocId(doc.id)}
                                                    >
                                                        <X className="h-3 w-3" /> Reject
                                                    </button>
                                                </div>
                                            )}
                                            {!isAdmin && reviewingDocId === doc.id && (
                                                <div className="mt-2 p-3 rounded-lg border bg-muted/20 space-y-2">
                                                    <Input
                                                        placeholder="Review note (optional)"
                                                        value={docReviewNotes}
                                                        onChange={e => setDocReviewNotes(e.target.value)}
                                                        className="h-7 text-xs"
                                                    />
                                                    <div className="flex gap-2">
                                                        <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleDocReview(doc.id, "APPROVED")}>
                                                            <Check className="h-3 w-3 mr-1" />Approve
                                                        </Button>
                                                        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleDocReview(doc.id, "REJECTED")}>
                                                            <X className="h-3 w-3 mr-1" />Reject
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setReviewingDocId(null); setDocReviewNotes(""); }}>
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Activity feed */}
                    {activityItems.length > 0 && (
                        <div>
                            <button
                                onClick={() => setShowHistory(v => !v)}
                                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <Clock className="h-3.5 w-3.5" />
                                {showHistory ? "Hide" : "Show"} activity ({activityItems.length})
                                {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                            {showHistory && (
                                <div className="mt-3 space-y-0 border-l-2 border-muted pl-4">
                                    {activityItems.map(item => (
                                        <div key={item.id} className="relative pb-4 last:pb-0">
                                            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-background
                                                            bg-muted-foreground/40"
                                                style={item.type === "timeline" && item.status
                                                    ? { backgroundColor: STATUS_COLORS[item.status]?.replace("bg-", "") }
                                                    : undefined}
                                            />
                                            <div className="flex items-start gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-xs font-medium">{item.label}</span>
                                                        {item.type === "comment" && item.isInternal && (
                                                            <Badge variant="secondary" className="text-[10px] py-0 h-4">Internal</Badge>
                                                        )}
                                                        <span className="text-[10px] text-muted-foreground">{formatDateTime(item.date)}</span>
                                                    </div>
                                                    {item.detail && (
                                                        <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Right column ── */}
                <div className="space-y-4">
                    {/* Outcome card — for finalised applications */}
                    {(isFinal || isPendingApproval) && (
                        <Card className={isFinal
                            ? application.status === "APPROVED"
                                ? "border-green-200 dark:border-green-800 bg-green-50/40 dark:bg-green-950/10"
                                : "border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-950/10"
                            : "border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/10"
                        }>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm">
                                    {isFinal ? "Outcome" : "Pending Sign-off"}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Badge className={getStatusColor(application.status)}>
                                    {getStatusLabel(application.status)}
                                </Badge>
                                {application.approvedAt && (
                                    <p className="text-xs text-muted-foreground">
                                        {application.status === "APPROVED" ? "Approved" : "Decided"} {formatDateTime(application.approvedAt)}
                                    </p>
                                )}
                                {application.certificate && (
                                    <div className="pt-1 space-y-1 text-sm border-t">
                                        <p className="text-xs font-medium">Certificate Issued</p>
                                        <p className="text-xs text-muted-foreground font-mono">{application.certificate.certificateNo}</p>
                                        {application.certificate.expiryDate && (
                                            <p className="text-xs text-muted-foreground">
                                                Valid until {formatDateTime(application.certificate.expiryDate)}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Role-specific action panel */}
                    {isAdmin ? (
                        <AdminPanel application={application} session={session} />
                    ) : (
                        <OfficerPanel
                            application={application}
                            session={session}
                            canDecide={canDecide}
                            isAssigned={isAssigned}
                            isFinal={isFinal || isPendingApproval}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
