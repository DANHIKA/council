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
import { UploadedFile } from "@/components/ui/file-upload";
import { formatDateTime, getStatusColor, getStatusLabel } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, Send } from "lucide-react";
import Link from "next/link";
import { useOfficerApplication, useAssignOfficer, useApproveApplication, useRejectApplication, useRequireCorrections, useCreateComment } from "@/lib/queries";
import { toast } from "sonner";

export default function OfficerReviewPage({ params }: { params: Promise<{ id: string }> }) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
    const [decisionNotes, setDecisionNotes] = useState("");
    const [internalNotes, setInternalNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const userRole = (session?.user as any)?.role;
    const isStaff = userRole === "OFFICER" || userRole === "ADMIN";

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
    if (!session || !isStaff) {
        router.push("/dashboard");
        return null;
    }

    if (isLoading) {
        return (
            <div className="container mx-auto py-8 max-w-5xl">
                <p className="text-muted-foreground">Loading application...</p>
            </div>
        );
    }

    if (error || !application) {
        return (
            <div className="container mx-auto py-8 max-w-5xl">
                <p className="text-destructive">Failed to load application</p>
                <Button variant="outline" className="mt-4" asChild>
                    <Link href="/officer/applications">Back to Queue</Link>
                </Button>
            </div>
        );
    }

    const handleAssign = async () => {
        try {
            await assignMutation.mutateAsync(application.id);
            toast.success("Application assigned to you");
        } catch (err: any) {
            toast.error(err.message || "Failed to assign application");
        }
    };

    const handleDecision = async (decision: "APPROVE" | "REJECT" | "REQUIRES_CORRECTION") => {
        if (!decisionNotes.trim()) {
            toast.error("Please provide decision notes");
            return;
        }

        setIsSubmitting(true);
        try {
            if (decision === "APPROVE") {
                await approveMutation.mutateAsync({
                    id: application.id,
                    notes: decisionNotes,
                });
            } else if (decision === "REJECT") {
                await rejectMutation.mutateAsync({
                    id: application.id,
                    notes: decisionNotes,
                });
            } else if (decision === "REQUIRES_CORRECTION") {
                await correctionsMutation.mutateAsync({
                    id: application.id,
                    notes: decisionNotes,
                });
            }
            
            toast.success(`Application ${decision.toLowerCase()}d`);
            if (internalNotes.trim()) {
                await commentMutation.mutateAsync({
                    content: internalNotes,
                    isInternal: true,
                });
            }
            router.push("/officer/applications");
        } catch (err: any) {
            toast.error(err.message || "Failed to submit decision");
        } finally {
            setIsSubmitting(false);
        }
    };

    const canDecide = application.officer?.id === (session?.user as any)?.id || userRole === "ADMIN";
    const isAssigned = !!application.officer;
    const isFinal = ["APPROVED", "REJECTED"].includes(application.status);

    return (
        <div className="container mx-auto py-8 max-w-5xl space-y-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/officer/applications">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Review Application</h1>
                    <p className="text-muted-foreground">{application.permitType}</p>
                </div>
                <Badge className={getStatusColor(application.status)}>
                    {getStatusLabel(application.status)}
                </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Application Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Description</Label>
                                <p className="mt-1">{application.description}</p>
                            </div>
                            <div>
                                <Label>Location</Label>
                                <p className="mt-1">{application.location}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Applicant</Label>
                                    <p className="mt-1">{application.applicant.name}</p>
                                    <p className="text-sm text-muted-foreground">{application.applicant.email}</p>
                                </div>
                                <div>
                                    <Label>Submitted</Label>
                                    <p className="mt-1">{formatDateTime(application.createdAt)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Documents</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {application.documents.length === 0 ? (
                                <p className="text-muted-foreground text-center py-4">No documents uploaded</p>
                            ) : (
                                <div className="space-y-3">
                                    {application.documents.map(doc => (
                                        <UploadedFile
                                            key={doc.id}
                                            file={doc}
                                            showStatus={true}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {application.comments.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Comments</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {application.comments.map(comment => (
                                    <div key={comment.id} className="border-l-2 border-muted pl-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium">{comment.author.name}</span>
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
                </div>

                <div className="space-y-6">
                    {!isAssigned && !isFinal && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Assign Application</CardTitle>
                                <CardDescription>Assign this application to yourself to begin review</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button onClick={handleAssign} disabled={assignMutation.isPending} className="w-full">
                                    {assignMutation.isPending ? "Assigning..." : "Assign to Me"}
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {isAssigned && !isFinal && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Decision</CardTitle>
                                <CardDescription>Submit your decision for this application</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="decisionNotes">Decision Notes *</Label>
                                    <Textarea
                                        id="decisionNotes"
                                        placeholder="Provide detailed notes for your decision..."
                                        value={decisionNotes}
                                        onChange={(e) => setDecisionNotes(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="internalNotes">Internal Notes (Optional)</Label>
                                    <Textarea
                                        id="internalNotes"
                                        placeholder="Internal notes for staff only..."
                                        value={internalNotes}
                                        onChange={(e) => setInternalNotes(e.target.value)}
                                    />
                                </div>
                                <Separator />
                                <div className="space-y-2">
                                    <Button
                                        onClick={() => handleDecision("APPROVE")}
                                        disabled={!canDecide || isSubmitting}
                                        className="w-full"
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Approve
                                    </Button>
                                    <Button
                                        onClick={() => handleDecision("REQUIRES_CORRECTION")}
                                        disabled={!canDecide || isSubmitting}
                                        variant="outline"
                                        className="w-full"
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
                            </CardContent>
                        </Card>
                    )}

                    {isFinal && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Final Decision</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Badge className={getStatusColor(application.status)}>
                                    {getStatusLabel(application.status)}
                                </Badge>
                                {application.certificate && (
                                    <div className="mt-4 space-y-2">
                                        <p className="text-sm font-medium">Certificate Generated</p>
                                        <p className="text-xs text-muted-foreground">
                                            {application.certificate.certificateNo}
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
