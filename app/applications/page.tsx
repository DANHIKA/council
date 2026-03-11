"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardDescription, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function ApplicationDetails({ id }: { id: string }) {
    const { data: application, isLoading } = useApplication(id);
    const { data: documents, isLoading: docsLoading } = useApplicationDocuments(id);

    if (isLoading) return <div className="p-4 text-center">Loading...</div>;
    if (!application) return <div className="p-4 text-center">Application not found</div>;

    return (
        <div className="space-y-6 py-4">
            <div className="space-y-4">
                <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Status</h4>
                    <Badge className={getStatusColor(application.status)}>
                        {getStatusLabel(application.status)}
                    </Badge>
                </div>
                <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
                    <p className="text-sm">{application.description}</p>
                </div>
                <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Location</h4>
                    <p className="text-sm">{application.location}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Submitted</h4>
                        <p className="text-sm">{formatDateTime(application.createdAt)}</p>
                    </div>
                    {application.reviewedAt && (
                        <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-1">Reviewed</h4>
                            <p className="text-sm">{formatDateTime(application.reviewedAt)}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                <h4 className="text-sm font-medium">Documents</h4>
                {docsLoading ? (
                    <p className="text-xs text-muted-foreground">Loading documents...</p>
                ) : !documents || documents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
                ) : (
                    <div className="grid gap-2">
                        {documents.map((doc: any) => (
                            <div key={doc.id} className="flex items-center justify-between p-2 border rounded-md text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                                        <FileText className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-medium line-clamp-1">{doc.fileName}</span>
                                        <span className="text-[10px] text-muted-foreground">{doc.requirement?.label || "General Document"}</span>
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

            <div className="pt-4 border-t">
                 <Button className="w-full" render={<Link href={`/applications/${application.id}`} />}>
                     Full Application View
                 </Button>
             </div>
        </div>
    );
}

const STATUS_OPTIONS = [
    { value: "all", label: "All Statuses" },
    { value: "SUBMITTED", label: "Submitted" },
    { value: "UNDER_REVIEW", label: "Under Review" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
    { value: "REQUIRES_CORRECTION", label: "Requires Correction" },
];

export default function ApplicationsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [page, setPage] = useState(1);

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
        if (!session) {
            router.push("/auth/login");
            return;
        }
    }, [status, session, router]);

    if (status === "loading") return null;
    if (!session) {
        router.push("/auth/login");
        return null;
    }

    return (
        <div className="container mx-auto py-8 space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Applications</h1>
                    <p className="text-muted-foreground">Manage and track your permit applications</p>
                </div>
                <Button render={<Link href="/applications/new" />}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Submit New Application
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Search & Filter</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by type, description, location, or applicant..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value || "all")}>
                            <SelectTrigger className="w-full sm:w-48">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {isLoading ? (
                <div className="text-center py-8">Loading applications...</div>
            ) : error ? (
                <Card>
                    <CardContent className="p-6 text-center">
                        <p className="text-destructive">Failed to load applications</p>
                    </CardContent>
                </Card>
            ) : applications.length === 0 ? (
                <Card>
                    <CardContent className="p-6 text-center">
                        <p className="text-muted-foreground mb-4">
                            {search || statusFilter
                                ? "No applications match your search criteria."
                                : "You haven't submitted any applications yet."}
                        </p>
                        {!search && !statusFilter && (
                            <Button render={<Link href="/applications/new" />}>
                                Create Your First Application
                            </Button>
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
                                                <div className="flex flex-col">
                                                    <span>{app.permitType}</span>
                                                    <span className="text-xs text-muted-foreground line-clamp-1 max-w-[300px]">
                                                        {app.description}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate">{app.location}</TableCell>
                                            <TableCell>{formatDateTime(app.createdAt)}</TableCell>
                                            <TableCell>
                                                <Badge className={getStatusColor(app.status)}>
                                                    {getStatusLabel(app.status)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Sheet>
                                                    <SheetTrigger
                                                        render={
                                                            <Button variant="ghost" size="sm">
                                                                <Eye className="h-4 w-4 mr-2" />
                                                                Quick View
                                                            </Button>
                                                        }
                                                    />
                                                    <SheetContent className="w-[400px] sm:w-[540px]">
                                                        <SheetHeader>
                                                            <SheetTitle>{app.permitType}</SheetTitle>
                                                            <SheetDescription>
                                                                Application Details & Documents
                                                            </SheetDescription>
                                                        </SheetHeader>
                                                        <ApplicationDetails id={app.id} />
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
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                            >
                                Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Page {page} of {pagination.pages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                                disabled={page >= pagination.pages}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
