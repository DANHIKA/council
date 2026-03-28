"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "@/hooks/useSession";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime, getStatusColor, getStatusLabel } from "@/lib/utils";
import { Search, Filter, Eye, FileText, Download, PlusCircle } from "lucide-react";
import Link from "next/link";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { useApplication, useApplicationDocuments, useApplications } from "@/lib/queries";
import { NewApplicationDialog } from "@/components/new-application-dialog";
import { EmptyState } from "@/components/empty-state";

function ApplicationQuickView({ id }: { id: string }) {
    const { data: application, isLoading } = useApplication(id);
    const { data: documents, isLoading: docsLoading } = useApplicationDocuments(id);

    if (isLoading) return <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>;
    if (!application) return <div className="p-4 text-center text-sm text-muted-foreground">Not found</div>;

    return (
        <div className="space-y-5 py-2">
            <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge className={getStatusColor(application.status)}>
                    {getStatusLabel(application.status)}
                </Badge>
            </div>
            <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="text-sm">{application.description}</p>
            </div>
            <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="text-sm">{application.location}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Submitted</p>
                    <p className="text-sm">{formatDateTime(application.createdAt)}</p>
                </div>
                {application.reviewedAt && (
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Reviewed</p>
                        <p className="text-sm">{formatDateTime(application.reviewedAt)}</p>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Documents</p>
                {docsLoading ? (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                ) : !documents?.length ? (
                    <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
                ) : (
                    <div className="space-y-2">
                        {documents.map((doc: any) => (
                            <div key={doc.id} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                        <FileText className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium truncate text-xs">{doc.fileName}</p>
                                        <p className="text-[10px] text-muted-foreground">{doc.requirement?.label || "General"}</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" render={<a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" />}>
                                    <Download className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="pt-2">
                <Button className="w-full" render={<Link href={`/applications/${application.id}`} />}>
                    Full view
                </Button>
            </div>
        </div>
    );
}

const STATUS_OPTIONS = [
    { value: "all", label: "All statuses" },
    { value: "SUBMITTED", label: "Submitted" },
    { value: "UNDER_REVIEW", label: "Under review" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
    { value: "REQUIRES_CORRECTION", label: "Requires correction" },
];

function ApplicationsPageInner() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [newDialogOpen, setNewDialogOpen] = useState(false);

    // Open new-application dialog when ?new=1 is in the URL
    useEffect(() => {
        if (searchParams.get("new") === "1") {
            setNewDialogOpen(true);
            // Remove the param without navigation
            const url = new URL(window.location.href);
            url.searchParams.delete("new");
            window.history.replaceState({}, "", url.toString());
        }
    }, [searchParams]);

    const { data: listData, isLoading, error } = useApplications({
        q: search,
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
        limit: 20,
    });

    const applications = listData?.data || [];
    const pagination = listData?.pagination;

    useEffect(() => {
        if (status === "loading") return;
        if (!session) router.push("/auth/login");
    }, [status, session, router]);

    if (status === "loading") return null;
    if (!session) return null;

    return (
        <>
            <div className="container mx-auto py-8 space-y-6">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Applications</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">Track and manage your permit applications</p>
                    </div>
                    <Button onClick={() => setNewDialogOpen(true)}>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        New application
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by type, description or location…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || "all")}>
                        <SelectTrigger className="w-full sm:w-48">
                            <Filter className="h-4 w-4 mr-2 shrink-0" />
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            {STATUS_OPTIONS.map(o => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Table */}
                {isLoading ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">Loading…</div>
                ) : error ? (
                    <Card><CardContent className="p-6 text-center"><p className="text-destructive text-sm">Failed to load applications</p></CardContent></Card>
                ) : applications.length === 0 ? (
                    <Card>
                        <CardContent className="p-0">
                            {search || statusFilter !== "all" ? (
                                <EmptyState
                                    variant="no-results"
                                    description="No applications match your current search or filters."
                                />
                            ) : (
                                <EmptyState
                                    title="No applications yet"
                                    description="Get started by submitting your first permit application."
                                    action={{ label: "Submit your first application", onClick: () => setNewDialogOpen(true) }}
                                />
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Location</TableHead>
                                            <TableHead>Submitted</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {applications.map((app) => (
                                            <TableRow key={app.id}>
                                                <TableCell className="font-medium">
                                                    <div>
                                                        <p>{app.permitType}</p>
                                                        <p className="text-xs text-muted-foreground line-clamp-1 max-w-[260px]">{app.description}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[180px] truncate text-sm">{app.location}</TableCell>
                                                <TableCell className="text-sm">{formatDateTime(app.createdAt)}</TableCell>
                                                <TableCell>
                                                    <Badge className={getStatusColor(app.status)}>
                                                        {getStatusLabel(app.status)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Sheet>
                                                        <SheetTrigger render={
                                                            <Button variant="ghost" size="sm">
                                                                <Eye className="h-4 w-4 mr-1.5" />
                                                                View
                                                            </Button>
                                                        } />
                                                        <SheetContent className="w-[400px] sm:w-[500px]">
                                                            <SheetHeader>
                                                                <SheetTitle>{app.permitType}</SheetTitle>
                                                                <SheetDescription>Application overview</SheetDescription>
                                                            </SheetHeader>
                                                            <div className="px-6 overflow-y-auto">
                                                                <ApplicationQuickView id={app.id} />
                                                            </div>
                                                        </SheetContent>
                                                    </Sheet>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {pagination && pagination.pages > 1 && (
                            <div className="flex justify-center items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                                    Previous
                                </Button>
                                <span className="text-sm text-muted-foreground">Page {page} of {pagination.pages}</span>
                                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}>
                                    Next
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <NewApplicationDialog
                open={newDialogOpen}
                onOpenChange={setNewDialogOpen}
                onSuccess={() => {}}
            />
        </>
    );
}

export default function ApplicationsPage() {
    return (
        <Suspense>
            <ApplicationsPageInner />
        </Suspense>
    );
}
