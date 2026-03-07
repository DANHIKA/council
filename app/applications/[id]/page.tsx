"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UploadedFile } from "@/components/file-upload";
import { formatDateTime, getStatusColor, getStatusLabel } from "@/lib/utils";
import { ArrowLeft, Download, FileText, MessageSquare, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useApplication, useApplicationDocuments, useDeleteDocument, useCreateComment, useDownloadCertificate } from "@/lib/queries";
import { toast } from "sonner";
import type { Application } from "@/lib/types";

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
    const [commentText, setCommentText] = useState("");

    const { data: application, isLoading, error } = useApplication(resolvedParams?.id || "");

    const { data: documents } = useApplicationDocuments(resolvedParams?.id || "");

    const deleteDocumentMutation = useDeleteDocument(resolvedParams?.id || "");
    const createCommentMutation = useCreateComment(resolvedParams?.id || "");
    const downloadCertificateMutation = useDownloadCertificate();

    useEffect(() => {
        if (status === "loading") return;
        if (!session) {
            router.push("/auth/login");
            return;
        }
        (async () => {
            const p = await params;
            setResolvedParams(p);
        })();
    }, [status, session, router, params]);

    if (status === "loading" || !resolvedParams) return null;
    if (!session) {
        router.push("/auth/login");
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
                    <Link href="/applications">Back to Applications</Link>
                </Button>
            </div>
        );
    }

    const userRole = (session?.user as any)?.role;
    const isOwner = application.applicant.id === (session?.user as any)?.id;
    const isOfficerOrAdmin = userRole === "OFFICER" || userRole === "ADMIN";

    const handleDeleteDocument = async (documentId: string) => {
        try {
            await deleteDocumentMutation.mutateAsync(documentId);
            toast.success("Document deleted");
        } catch (err: any) {
            toast.error(err.message || "Failed to delete document");
        }
    };

    const handleAddComment = async () => {
        if (!commentText.trim()) return;
        try {
            await createCommentMutation.mutateAsync({
                content: commentText,
                isInternal: false,
            });
            setCommentText("");
            toast.success("Comment added");
        } catch (err: any) {
            toast.error(err.message || "Failed to add comment");
        }
    };

    const handleDownloadCertificate = async () => {
        try {
            const result = await downloadCertificateMutation.mutateAsync(application.id);
            // Create blob and download
            const blob = new Blob([result as any], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `certificate-${application.certificate?.certificateNo}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err: any) {
            toast.error(err.message || "Failed to download certificate");
        }
    };

    return (
        <div className="container mx-auto py-8 max-w-5xl space-y-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/applications">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Application Details</h1>
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
                                <h3 className="font-medium">Description</h3>
                                <p className="mt-1">{application.description}</p>
                            </div>
                            <div>
                                <h3 className="font-medium">Location</h3>
                                <p className="mt-1">{application.location}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h3 className="font-medium">Applicant</h3>
                                    <p className="mt-1">{application.applicant.name}</p>
                                    <p className="text-sm text-muted-foreground">{application.applicant.email}</p>
                                </div>
                                <div>
                                    <h3 className="font-medium">Submitted</h3>
                                    <p className="mt-1">{formatDateTime(application.createdAt)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Documents</CardTitle>
                            {isOwner && application.status !== "APPROVED" && application.status !== "REJECTED" && (
                                <Button size="sm" asChild>
                                    <Link href={`/applications/${application.id}/edit`}>
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add Document
                                    </Link>
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent>
                            {documents && documents.length > 0 ? (
                                <div className="space-y-3">
                                    {documents.map(doc => (
                                        <UploadedFile
                                            key={doc.id}
                                            file={doc}
                                            showStatus={true}
                                            onDelete={isOwner && application.status !== "APPROVED" && application.status !== "REJECTED" 
                                                ? () => handleDeleteDocument(doc.id) 
                                                : undefined}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-center py-4">No documents uploaded</p>
                            )}
                        </CardContent>
                    </Card>

                    {application.comments && application.comments.length > 0 && (
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

                    {application.timeline && application.timeline.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Timeline</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {application.timeline.map(event => (
                                    <div key={event.id} className="flex gap-3">
                                        <div className="mt-1">
                                            <div className={`w-2 h-2 rounded-full ${
                                                event.status === "APPROVED" ? "bg-green-500" :
                                                event.status === "REJECTED" ? "bg-red-500" :
                                                event.status === "UNDER_REVIEW" ? "bg-yellow-500" :
                                                "bg-blue-500"
                                            }`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm">{event.event}</p>
                                            {event.description && (
                                                <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                                            )}
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {formatDateTime(event.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="space-y-6">
                    {application.certificate && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Certificate
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="text-sm space-y-1">
                                    <p><strong>No:</strong> {application.certificate.certificateNo}</p>
                                    <p><strong>Issued:</strong> {formatDateTime(application.certificate.issueDate)}</p>
                                    <p><strong>Expires:</strong> {formatDateTime(application.certificate.expiryDate)}</p>
                                </div>
                                <Button className="w-full" onClick={handleDownloadCertificate} disabled={downloadCertificateMutation.isPending}>
                                    <Download className="h-4 w-4 mr-2" />
                                    {downloadCertificateMutation.isPending ? "Downloading..." : "Download Certificate"}
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {isOfficerOrAdmin && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Officer Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Button className="w-full" variant="outline" asChild>
                                    <Link href={`/officer/review/${application.id}`}>
                                        Review Application
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
