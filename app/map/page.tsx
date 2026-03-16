"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime, getStatusColor, getStatusLabel } from "@/lib/utils";
import { MapPin, Filter, Eye, Layers, Loader2 } from "lucide-react";
import Link from "next/link";
import { useApplications, usePermitTypes } from "@/lib/queries";
import dynamic from "next/dynamic";

// Dynamically import the map component to avoid SSR issues with Leaflet
const PermitMap = dynamic(() => import("@/components/map/permit-map"), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full flex items-center justify-center bg-muted/20 rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    ),
});

const STATUS_FILTERS = [
    { value: "all", label: "All Statuses" },
    { value: "SUBMITTED", label: "Submitted" },
    { value: "UNDER_REVIEW", label: "Under Review" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
    { value: "REQUIRES_CORRECTION", label: "Requires Correction" },
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
        limit: 100, // Get more for map view
    });

    const { data: permitTypesData } = usePermitTypes();

    const applications = listData?.data || [];
    const permitTypes = permitTypesData || [];

    // Filter applications with location data
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
        <div className="container mx-auto py-8 max-w-7xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Permit Map</h1>
                    <p className="text-muted-foreground">Geographic view of permit applications</p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by description, location..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value || "all")}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_FILTERS.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={permitTypeFilter} onValueChange={(value) => setPermitTypeFilter(value || "all")}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by permit type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {permitTypes.map(type => (
                                    <SelectItem key={type.id} value={type.name}>
                                        {type.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Map View */}
                <div className="lg:col-span-2">
                    <Card className="h-[600px] flex flex-col">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                Map View
                            </CardTitle>
                            <CardDescription>
                                Showing {applicationsWithLocation.length} permits with location data
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 relative overflow-hidden rounded-b-lg">
                             <PermitMap applications={applicationsWithLocation} />
                        </CardContent>
                    </Card>
                </div>

                {/* Application List */}
                <div className="space-y-4">
                    <Card className="h-[calc(600px-8rem)] overflow-hidden flex flex-col">
                        <CardHeader>
                            <CardTitle>Applications</CardTitle>
                            <CardDescription>
                                {applicationsWithLocation.length} results
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 overflow-y-auto flex-1 p-4 pt-0">
                            {isLoading ? (
                                <p className="text-muted-foreground">Loading...</p>
                            ) : error ? (
                                <p className="text-destructive">Failed to load applications</p>
                            ) : applicationsWithLocation.length === 0 ? (
                                <p className="text-muted-foreground text-center py-4">
                                    No applications with location data found matching your filters.
                                </p>
                            ) : (
                                applicationsWithLocation.map(app => (
                                    <div key={app.id} className="p-3 border rounded-lg space-y-2 hover:bg-muted/50 transition-colors">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-medium text-sm">{app.permitType}</h4>
                                                    <Badge className={getStatusColor(app.status)} variant="secondary">
                                                        {getStatusLabel(app.status)}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground line-clamp-2">
                                                    {app.description}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    📍 {app.location}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDateTime(app.createdAt)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Link href={`/applications/${app.id}`}>
                                                    <Button size="sm" variant="outline">
                                                        View
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Legend */}
                    <Card>
                        <CardHeader className="py-3">
                            <CardTitle className="text-sm">Legend</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-2 pb-3">
                            {STATUS_FILTERS.slice(1).map(filter => (
                                <div key={filter.value} className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                        filter.value === "APPROVED" ? "bg-green-500" :
                                        filter.value === "REJECTED" ? "bg-red-500" :
                                        filter.value === "UNDER_REVIEW" ? "bg-yellow-500" :
                                        filter.value === "REQUIRES_CORRECTION" ? "bg-orange-500" :
                                        "bg-blue-500"
                                    }`} />
                                    <span className="text-xs">{filter.label}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
