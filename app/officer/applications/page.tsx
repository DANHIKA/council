"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime, getStatusColor, getStatusLabel } from "@/lib/utils";
import { Search, Filter, Eye, FileText, Download, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useOfficerQueue } from "@/lib/queries";

const STATUS_OPTIONS = [
    { value: "all", label: "All Statuses" },
    { value: "SUBMITTED", label: "Submitted" },
    { value: "UNDER_REVIEW", label: "Under Review" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
    { value: "REQUIRES_CORRECTION", label: "Requires Correction" },
];

const STATUS_STATS = [
    { status: "SUBMITTED", label: "Submitted", color: "#3b82f6", icon: Clock },
    { status: "UNDER_REVIEW", label: "Under Review", color: "#f59e0b", icon: Clock },
    { status: "APPROVED", label: "Approved", color: "#22c55e", icon: CheckCircle },
    { status: "REJECTED", label: "Rejected", color: "#ef4444", icon: XCircle },
    { status: "REQUIRES_CORRECTION", label: "Needs Correction", color: "#f97316", icon: AlertCircle },
];

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
import { useApplication, useApplicationDocuments } from "@/lib/queries";

function ApplicationDetails({ id }: { id: string }) {
    const { data: application, isLoading } = useApplication(id);
    const { data: documents, isLoading: docsLoading } = useApplicationDocuments(id);

    if (isLoading) return <div className="p-4 text-center">Loading...</div>;
    if (!application) return <div className="p-4 text-center">Application not found</div>;

    return (
        <div className="space-y-6 py-4">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Status</h4>
                        <Badge className={getStatusColor(application.status)}>
                            {getStatusLabel(application.status)}
                        </Badge>
                    </div>
                    <div className="text-right">
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Submitted</h4>
                        <p className="text-sm">{formatDateTime(application.createdAt)}</p>
                    </div>
                </div>
                <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Applicant</h4>
                    <p className="text-sm font-medium">{application.applicant.name}</p>
                    <p className="text-xs text-muted-foreground">{application.applicant.email}</p>
                </div>
                <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
                    <p className="text-sm">{application.description}</p>
                </div>
                <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Location</h4>
                    <p className="text-sm">{application.location}</p>
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

            <div className="pt-4 border-t space-y-2">
                <Button className="w-full" render={<Link href={`/officer/review/${application.id}`} />}>
                    Full Review View
                </Button>
            </div>
        </div>
    );
}

export default function OfficerApplicationsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [page, setPage] = useState(1);

    const userRole = (session?.user as any)?.role;
    const isStaff = userRole === "OFFICER" || userRole === "ADMIN";

    const { data: listData, isLoading, error } = useOfficerQueue({
        q: search,
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
        limit: 100,
    });

    if (status === "loading") return null;
    if (!session) {
        router.push("/auth/login");
        return null;
    }
    if (!isStaff) {
        router.push("/dashboard");
        return null;
    }

    const applications = listData?.data || [];
    const pagination = listData?.pagination;

    // Calculate stats
    const stats = useMemo(() => {
        const statusCounts = STATUS_STATS.map(s => ({
            ...s,
            count: applications.filter(a => a.status === s.status).length
        }));
        
        return { statusCounts, total: applications.length };
    }, [applications]);

    return (
        <div className="container mx-auto py-8 max-w-7xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Officer Dashboard</h1>
                    <p className="text-muted-foreground">Review and manage permit applications</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-5">
                {STATUS_STATS.map(({ status, label, color, icon: Icon }) => {
                    const count = stats.statusCounts.find(s => s.status === status)?.count || 0;
                    return (
                        <Card key={status}>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-2xl font-bold">{count}</p>
                                        <p className="text-xs text-muted-foreground">{label}</p>
                                    </div>
                                    <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                                        <Icon className="h-5 w-5" style={{ color }} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Applications Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Application Queue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value || "")}>
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

                    {isLoading ? (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">Loading applications...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-8">
                            <p className="text-destructive">Failed to load applications</p>
                        </div>
                    ) : applications.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">No applications found</p>
                        </div>
                    ) : (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Type & Description</TableHead>
                                        <TableHead>Applicant</TableHead>
                                        <TableHead>Submitted</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {applications.map((app: any) => (
                                        <TableRow key={app.id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{app.permitType}</span>
                                                    <span className="text-xs text-muted-foreground line-clamp-1 max-w-[250px]">
                                                        {app.description}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">{app.applicant.name}</span>
                                                    <span className="text-[10px] text-muted-foreground">{app.applicant.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {formatDateTime(app.createdAt)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={getStatusColor(app.status)}>
                                                    {getStatusLabel(app.status)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Sheet>
                                                        <SheetTrigger
                                                            render={
                                                                <Button size="sm" variant="ghost">
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                            }
                                                        />
                                                        <SheetContent className="w-[400px] sm:w-[540px]">
                                                            <SheetHeader>
                                                                <SheetTitle>{app.permitType}</SheetTitle>
                                                                <SheetDescription>
                                                                    Review Application Details & Documents
                                                                </SheetDescription>
                                                            </SheetHeader>
                                                            <ApplicationDetails id={app.id} />
                                                        </SheetContent>
                                                    </Sheet>
                                                    <Button size="sm" render={<Link href={`/officer/review/${app.id}`} />}>
                                                        Review
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {pagination && pagination.pages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Page {pagination.page} of {pagination.pages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= pagination.pages}
                                onClick={() => setPage(p => p + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
