"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime, getStatusColor, getStatusLabel } from "@/lib/utils";
import { Search, Filter, Eye } from "lucide-react";
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
        limit: 20,
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

    return (
        <div className="container mx-auto py-8 max-w-7xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Officer Queue</h1>
                    <p className="text-muted-foreground">Review and manage permit applications</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Applications</CardTitle>
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
                        <div className="space-y-3">
                            {applications.map((app: any) => (
                                <Card key={app.id} className="hover:bg-muted/50 transition-colors">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-medium">{app.permitType}</h3>
                                                    <Badge className={getStatusColor(app.status)}>
                                                        {getStatusLabel(app.status)}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground line-clamp-2">{app.description}</p>
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                    <span>📍 {app.location}</span>
                                                    <span>👤 {app.applicant.email}</span>
                                                    <span>📅 {formatDateTime(app.createdAt)}</span>
                                                </div>
                                            </div>
                                            <Button size="sm" asChild>
                                                <Link href={`/officer/review/${app.id}`}>
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    Review
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
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
