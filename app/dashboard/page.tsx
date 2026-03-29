"use client";

import { useSession } from "@/hooks/useSession";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, getStatusColor, getStatusLabel } from "@/lib/utils";
import { FileText, PlusCircle, Eye, Download, AlertCircle, Bell } from "lucide-react";
import Link from "next/link";
import { useApplications, useNotifications } from "@/lib/queries";
import { usePermissions } from "@/hooks/usePermissions";
import { ApplicantOnly, StaffOnly } from "@/components/permission-guard";
import { EmptyState } from "@/components/empty-state";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

const STATUS_STATS = [
    { status: "SUBMITTED", label: "Submitted", color: "bg-blue-500" },
    { status: "UNDER_REVIEW", label: "Under Review", color: "bg-yellow-500" },
    { status: "PENDING_APPROVAL", label: "Pending Sign-off", color: "bg-purple-500" },
    { status: "APPROVED", label: "Approved", color: "bg-green-500" },
    { status: "REJECTED", label: "Rejected", color: "bg-red-500" },
    { status: "REQUIRES_CORRECTION", label: "Needs Correction", color: "bg-orange-500" },
];

const STATUS_CHART_COLORS: Record<string, string> = {
    SUBMITTED: "hsl(217, 91%, 60%)",
    UNDER_REVIEW: "hsl(48, 96%, 53%)",
    PENDING_APPROVAL: "hsl(271, 81%, 56%)",
    APPROVED: "hsl(142, 71%, 45%)",
    REJECTED: "hsl(0, 84%, 60%)",
    REQUIRES_CORRECTION: "hsl(25, 95%, 53%)",
};

const chartConfig = {
    count: { label: "Applications" },
};

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
                                        <span className="font-medium line-clamp-1">{doc.name}</span>
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

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { isApplicant, isStaff } = usePermissions();
    const { data: notificationsData, isLoading: loadingNotifications } = useNotifications();

    const { data: listData, isLoading, error } = useApplications({ limit: 100 });
    const applications = listData?.data || [];

    const notifications = notificationsData?.notifications?.slice(0, 5) || [];

    // Calculate stats directly from applications
    const stats = STATUS_STATS.reduce((acc, { status }) => {
        acc[status] = applications.filter(app => app.status === status).length;
        return acc;
    }, {} as Record<string, number>);

    // Chart data
    const statusChartData = STATUS_STATS
        .map(({ status, label }) => ({ name: label, count: stats[status] || 0, fill: STATUS_CHART_COLORS[status] }))
        .filter(d => d.count > 0);

    const typeCountMap: Record<string, number> = {};
    for (const app of applications) {
        typeCountMap[app.permitType] = (typeCountMap[app.permitType] || 0) + 1;
    }
    const typeChartData = Object.entries(typeCountMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name, count }));

    if (status === "loading") return null;

    if (!session) {
        router.push("/auth/login");
        return null;
    }

    const recentApplications = applications.slice(0, 5);

    return (
        <div className="container mx-auto py-8 max-w-7xl space-y-8">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground">
                        Welcome back, {session?.user?.name || "User"}
                    </p>
                </div>
                <ApplicantOnly>
                    <Button render={<Link href="/applications?new=1" />}>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Submit New Application
                    </Button>
                </ApplicantOnly>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {STATUS_STATS.map(({ status, label, color }) => (
                    <Card key={status}>
                        <CardContent className="p-6">
                            <div className="flex items-center space-x-2">
                                <div className={`w-3 h-3 rounded-full ${color}`} />
                                <div>
                                    <p className="text-2xl font-bold">{stats[status] || 0}</p>
                                    <p className="text-sm text-muted-foreground">{label}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Charts */}
            {!isLoading && applications.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Status Breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Status Breakdown</CardTitle>
                            <CardDescription>Applications by current status</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={chartConfig} className="h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={statusChartData}
                                            dataKey="count"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={80}
                                            label={({ name, count }) => `${name}: ${count}`}
                                            labelLine={false}
                                        >
                                            {statusChartData.map((entry, i) => (
                                                <Cell key={i} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<ChartTooltipContent />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </CardContent>
                    </Card>

                    {/* By Permit Type */}
                    <Card>
                        <CardHeader>
                            <CardTitle>By Permit Type</CardTitle>
                            <CardDescription>Application count per permit type</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={chartConfig} className="h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={typeChartData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" tick={{ fontSize: 11 }} />
                                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                                        <Tooltip content={<ChartTooltipContent />} />
                                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Applications */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Recent Applications</CardTitle>
                        <CardDescription>Your latest permit applications</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <p className="text-muted-foreground p-6">Loading...</p>
                        ) : error ? (
                            <p className="text-destructive p-6">Failed to load applications</p>
                        ) : recentApplications.length === 0 ? (
                            <EmptyState
                                title="No applications yet"
                                description="Your recent permit applications will appear here."
                            />
                        ) : (
                            <div className="space-y-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {recentApplications.map(app => (
                                            <TableRow key={app.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex flex-col">
                                                        <span>{app.permitType}</span>
                                                        <span className="text-[10px] text-muted-foreground line-clamp-1">
                                                            {formatDateTime(app.createdAt)}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={getStatusColor(app.status)}>
                                                        {getStatusLabel(app.status)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
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
                                                                    Quick overview of your application
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
                                {applications.length > 5 && (
                                    <div className="p-4 pt-0">
                                        <Button variant="outline" className="w-full" render={<Link href="/applications" />}>
                                            View All Applications
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                        <CardDescription>Common tasks and shortcuts</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <ApplicantOnly>
                            <Button className="w-full justify-start" render={<Link href="/applications?new=1" />}>
                                <PlusCircle className="h-4 w-4 mr-2" />
                                Submit New Application
                            </Button>
                            <Button variant="outline" className="w-full justify-start" render={<Link href="/applications" />}>
                                <FileText className="h-4 w-4 mr-2" />
                                View My Applications
                            </Button>
                        </ApplicantOnly>
                        <StaffOnly>
                            <Button className="w-full justify-start" render={<Link href="/officer/applications" />}>
                                <Eye className="h-4 w-4 mr-2" />
                                Review Applications
                            </Button>
                            <Button variant="outline" className="w-full justify-start" render={<Link href="/applications" />}>
                                <FileText className="h-4 w-4 mr-2" />
                                All Applications
                            </Button>
                        </StaffOnly>
                        <Button variant="outline" className="w-full justify-start" render={<Link href="/map" />}>
                            <Download className="h-4 w-4 mr-2" />
                            Permit Map
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
