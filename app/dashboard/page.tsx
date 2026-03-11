"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, getStatusColor, getStatusLabel } from "@/lib/utils";
import { FileText, PlusCircle, Eye, Download, AlertCircle, Bell } from "lucide-react";
import Link from "next/link";
import { useApplications, useNotifications } from "@/lib/queries";
import type { UserRole } from "@/lib/types";

const STATUS_STATS = [
    { status: "SUBMITTED", label: "Submitted", color: "bg-blue-500" },
    { status: "UNDER_REVIEW", label: "Under Review", color: "bg-yellow-500" },
    { status: "APPROVED", label: "Approved", color: "bg-green-500" },
    { status: "REJECTED", label: "Rejected", color: "bg-red-500" },
    { status: "REQUIRES_CORRECTION", label: "Needs Correction", color: "bg-orange-500" },
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

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { data: notificationsData, isLoading: loadingNotifications } = useNotifications();

    const { data: listData, isLoading, error } = useApplications({ limit: 100 });
    const applications = listData?.data || [];

    const notifications = notificationsData?.notifications?.slice(0, 5) || [];

    // Calculate stats directly from applications
    const stats = STATUS_STATS.reduce((acc, { status }) => {
        acc[status] = applications.filter(app => app.status === status).length;
        return acc;
    }, {} as Record<string, number>);

    if (status === "loading") return null;
    if (!session) {
        router.push("/auth/login");
        return null;
    }

    const userRole = (session?.user as { role: UserRole })?.role;
    const isApplicant = userRole === "APPLICANT";
    const isStaff = userRole === "OFFICER" || userRole === "ADMIN";

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
                {isApplicant && (
                    <Button render={<Link href="/applications/new" />}>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Submit New Application
                    </Button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Applications */}
                <Card>
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
                            <p className="text-muted-foreground text-center py-8">
                                No applications yet
                            </p>
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
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                        <CardDescription>Common tasks and shortcuts</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {isApplicant && (
                            <>
                                <Button className="w-full justify-start" render={<Link href="/applications/new" />}>
                                    <PlusCircle className="h-4 w-4 mr-2" />
                                    Submit New Application
                                </Button>
                                <Button variant="outline" className="w-full justify-start" render={<Link href="/applications" />}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    View My Applications
                                </Button>
                            </>
                        )}
                        {isStaff && (
                            <>
                                <Button className="w-full justify-start" render={<Link href="/officer/applications" />}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Review Applications
                                </Button>
                                <Button variant="outline" className="w-full justify-start" render={<Link href="/applications" />}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    All Applications
                                </Button>
                            </>
                        )}
                        <Button variant="outline" className="w-full justify-start" render={<Link href="/map" />}>
                            <Download className="h-4 w-4 mr-2" />
                            Permit Map
                        </Button>
                    </CardContent>
                </Card>

                {/* Latest Notifications */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bell className="h-5 w-5" />
                            Latest Notifications
                        </CardTitle>
                        <CardDescription>Stay updated on your applications</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loadingNotifications ? (
                            <p className="text-muted-foreground">Loading notifications...</p>
                        ) : notifications.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">
                                No notifications yet
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {notifications.map((notification) => (
                                    <Link
                                        key={notification.id}
                                        href={notification.link || "#"}
                                        className={`block p-3 rounded-lg border transition-colors hover:bg-muted/50 ${!notification.read ? "bg-muted/30 border-primary/20" : ""}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-medium text-sm">{notification.title}</h4>
                                            {!notification.read && (
                                                <Badge variant="default" className="text-[10px] px-1.5 h-4">New</Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-1">
                                            {notification.message}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground mt-2">
                                            {formatDateTime(notification.createdAt)}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Alerts for corrections needed */}
            {applications.some(app => app.status === "REQUIRES_CORRECTION") && (
                <Card className="border-orange-200 bg-orange-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-orange-800">
                            <AlertCircle className="h-5 w-5" />
                            Action Required
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-orange-700 mb-4">
                            You have applications that require corrections. Please review and update them.
                        </p>
                        <div className="space-y-2">
                            {applications
                                .filter(app => app.status === "REQUIRES_CORRECTION")
                                .slice(0, 3)
                                .map(app => (
                                    <div key={app.id} className="flex items-center justify-between p-2 bg-white rounded border">
                                        <div>
                                            <p className="font-medium">{app.permitType}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {formatDateTime(app.updatedAt)}
                                            </p>
                                        </div>
                                        <Button size="sm" render={<Link href={`/applications/${app.id}`} />}>
                                            Review
                                        </Button>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
