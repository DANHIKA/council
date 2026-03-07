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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Dashboard</h1>
                    <p className="text-muted-foreground">
                        Welcome back, {session.user?.name || "User"}
                    </p>
                </div>
                {isApplicant && (
                    <Button asChild>
                        <Link href="/applications/new">
                            <PlusCircle className="h-4 w-4 mr-2" />
                            New Application
                        </Link>
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
                    <CardContent>
                        {isLoading ? (
                            <p className="text-muted-foreground">Loading...</p>
                        ) : error ? (
                            <p className="text-destructive">Failed to load applications</p>
                        ) : recentApplications.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">
                                No applications yet
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {recentApplications.map(app => (
                                    <div key={app.id} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-medium">{app.permitType}</h4>
                                                <Badge className={getStatusColor(app.status)}>
                                                    {getStatusLabel(app.status)}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground line-clamp-1">
                                                {app.description}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDateTime(app.createdAt)}
                                            </p>
                                        </div>
                                        <Button size="sm" variant="outline" asChild>
                                            <Link href={`/applications/${app.id}`}>
                                                        <Eye className="h-4 w-4 mr-1" />
                                                        View
                                                    </Link>
                                        </Button>
                                    </div>
                                ))}
                                {applications.length > 5 && (
                                    <Button variant="outline" className="w-full" asChild>
                                        <Link href="/applications">View All Applications</Link>
                                    </Button>
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
                                <Button className="w-full justify-start" asChild>
                                    <Link href="/applications/new">
                                        <PlusCircle className="h-4 w-4 mr-2" />
                                        Submit New Application
                                    </Link>
                                </Button>
                                <Button variant="outline" className="w-full justify-start" asChild>
                                    <Link href="/applications">
                                        <FileText className="h-4 w-4 mr-2" />
                                        View My Applications
                                    </Link>
                                </Button>
                            </>
                        )}
                        {isStaff && (
                            <>
                                <Button className="w-full justify-start" asChild>
                                    <Link href="/officer/applications">
                                        <Eye className="h-4 w-4 mr-2" />
                                        Review Applications
                                    </Link>
                                </Button>
                                <Button variant="outline" className="w-full justify-start" asChild>
                                    <Link href="/applications">
                                        <FileText className="h-4 w-4 mr-2" />
                                        All Applications
                                    </Link>
                                </Button>
                            </>
                        )}
                        <Button variant="outline" className="w-full justify-start" asChild>
                            <Link href="/map">
                                <Download className="h-4 w-4 mr-2" />
                                Permit Map
                            </Link>
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
                                        <Button size="sm" asChild>
                                            <Link href={`/applications/${app.id}`}>Review</Link>
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
