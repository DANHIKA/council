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
import { MapPin, Loader2 } from "lucide-react";
import Link from "next/link";
import { useApplications, usePermitTypes } from "@/lib/queries";
import { EmptyState } from "@/components/empty-state";
import dynamic from "next/dynamic";

const PermitMap = dynamic(() => import("@/components/map/permit-map"), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full flex items-center justify-center bg-muted/20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    ),
});

const STATUS_FILTERS = [
    { value: "all", label: "All Statuses" },
    { value: "SUBMITTED", label: "Submitted", color: "bg-blue-500" },
    { value: "UNDER_REVIEW", label: "Under Review", color: "bg-yellow-500" },
    { value: "APPROVED", label: "Approved", color: "bg-green-500" },
    { value: "REJECTED", label: "Rejected", color: "bg-red-500" },
    { value: "REQUIRES_CORRECTION", label: "Requires Correction", color: "bg-orange-500" },
];

export default function PermitMapPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [permitTypeFilter, setPermitTypeFilter] = useState("all");

    const { data: listData, isLoading, error } = useApplications({
        q: search,
        status: statusFilter === "all" ? undefined : statusFilter,
        limit: 100,
    });

    const { data: permitTypesData } = usePermitTypes();

    const applications = listData?.data || [];
    const permitTypes = permitTypesData || [];

    const applicationsWithLocation = applications.filter(app =>
        app.latitude && app.longitude &&
        (permitTypeFilter === "all" || app.permitType === permitTypeFilter)
    );

    if (status === "loading") return null;
    if (!session) {
        router.push("/auth/login");
        return null;
    }

    return (
        <div className="container mx-auto py-8 max-w-7xl space-y-4">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Permit Map</h1>
                <p className="text-muted-foreground">Geographic view of permit applications</p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-md">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by description or location..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || "all")}>
                    <SelectTrigger className="sm:w-48">
                        <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        {STATUS_FILTERS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={permitTypeFilter} onValueChange={(v) => setPermitTypeFilter(v || "all")}>
                    <SelectTrigger className="sm:w-48">
                        <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {permitTypes.map(type => (
                            <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Map + Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Map */}
                <div className="lg:col-span-2">
                    <Card className="h-[600px] overflow-hidden">
                        <CardContent className="h-full p-0">
                            <PermitMap applications={applicationsWithLocation} />
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <Card className="h-[600px] flex flex-col overflow-hidden">
                    <CardHeader className="pb-2 shrink-0">
                        <CardTitle className="text-sm font-medium">
                            Applications
                            <span className="ml-1.5 text-muted-foreground font-normal">
                                ({applicationsWithLocation.length})
                            </span>
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="flex-1 overflow-y-auto p-3 pt-0 space-y-2">
                        {isLoading ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
                        ) : error ? (
                            <EmptyState variant="error" title="Failed to load" className="py-6" />
                        ) : applicationsWithLocation.length === 0 ? (
                            <EmptyState
                                variant={search || statusFilter !== "all" || permitTypeFilter !== "all" ? "no-results" : "no-data"}
                                title="No applications with location data"
                                className="py-6"
                            />
                        ) : (
                            applicationsWithLocation.map(app => (
                                <div key={app.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{app.permitType}</p>
                                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                                {app.location}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDateTime(app.createdAt)}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                                            <Badge className={getStatusColor(app.status)}>
                                                {getStatusLabel(app.status)}
                                            </Badge>
                                            <Button size="sm" variant="outline" className="h-6 text-xs px-2" render={<Link href={`/applications/${app.id}`} />}>
                                                View
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>

                    {/* Legend */}
                    <div className="border-t p-3 shrink-0">
                        <div className="grid grid-cols-2 gap-1.5">
                            {STATUS_FILTERS.slice(1).map(f => (
                                <div key={f.value} className="flex items-center gap-1.5">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${f.color}`} />
                                    <span className="text-xs text-muted-foreground">{f.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
