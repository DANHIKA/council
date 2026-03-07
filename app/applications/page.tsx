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
import { Search, Filter, Eye } from "lucide-react";
import Link from "next/link";
import { useApplications } from "@/lib/queries";
import type { Application } from "@/lib/types";

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
    const userRole = (session?.user as any)?.role;
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">My Applications</h1>
                    <p className="text-muted-foreground">Track and manage your permit applications</p>
                </div>
                <Button asChild>
                    <Link href="/applications/new">New Application</Link>
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
                            <Button asChild>
                                <Link href="/applications/new">Create Your First Application</Link>
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid gap-4">
                        {applications.map(app => (
                            <Card key={app.id} className="hover:shadow-md transition-shadow">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <CardTitle className="text-lg">{app.permitType}</CardTitle>
                                            <CardDescription className="line-clamp-2">{app.description}</CardDescription>
                                        </div>
                                        <Badge className={getStatusColor(app.status)}>
                                            {getStatusLabel(app.status)}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        <div className="grid gap-2 text-sm text-muted-foreground">
                                            <p>Location: {app.location}</p>
                                            <p>Applicant: {app.applicant.name} ({app.applicant.email})</p>
                                            <p>Submitted: {formatDateTime(app.createdAt)}</p>
                                            {app.reviewedAt && (
                                                <p>Reviewed: {formatDateTime(app.reviewedAt)}</p>
                                            )}
                                            {app.certificate && (
                                                <p className="text-green-600 font-medium">
                                                    Certificate: {app.certificate.certificateNo}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex justify-end">
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={`/applications/${app.id}`}>
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    View Details
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

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
