"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Users, Shield, FileText, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime, getStatusColor, getStatusLabel } from "@/lib/utils";
import { adminApi, type AdminUser } from "@/lib/services/admin";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { useAdminSignoffQueue, useAdminSignoff } from "@/lib/queries";

export default function AdminPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [signoffNotes, setSignoffNotes] = useState<Record<string, string>>({});
    const [confirming, setConfirming] = useState<{ id: string; decision: "APPROVE" | "REJECT" } | null>(null);

    const { isAdmin } = usePermissions();

    const { data: signoffData, isLoading: signoffLoading } = useAdminSignoffQueue();
    const signoffMutation = useAdminSignoff();

    const pendingApps = signoffData?.data || [];
    const pendingCount = signoffData?.pagination?.total || 0;

    useEffect(() => {
        if (status === "loading") return;
        if (!session) {
            router.push("/auth/login");
            return;
        }
        if (!isAdmin) {
            router.push("/dashboard");
            return;
        }

        fetchUsers();
    }, [session, status, isAdmin, router]);

    const fetchUsers = async () => {
        try {
            const data = await adminApi.getUsers();
            setUsers(data.users || []);
        } catch (err) {
            console.error("Failed to fetch users:", err);
            toast.error("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        const originalUsers = [...users];
        
        // Optimistic update
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole as any } : u));

        try {
            await adminApi.updateUserRole(userId, newRole);
            toast.success("User role updated");
        } catch (err: any) {
            // Revert on error
            setUsers(originalUsers);
            toast.error(err.message || "Failed to update role");
        }
    };

    if (status === "loading" || loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAdmin) return null;

    const totalUsers = users.length;
    const totalOfficers = users.filter(u => u.role === "OFFICER").length;
    const totalAdmins = users.filter(u => u.role === "ADMIN").length;
    const totalApplicants = users.filter(u => u.role === "APPLICANT").length;

    return (
        <div className="container mx-auto py-8 max-w-7xl space-y-8">
            <div>
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                <p className="text-muted-foreground">System administration and user management</p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalUsers}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Admins</CardTitle>
                        <Shield className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalAdmins}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Officers</CardTitle>
                        <Shield className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalOfficers}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Applicants</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalApplicants}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Pending Sign-off Queue */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                Pending Sign-off
                                {pendingCount > 0 && (
                                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-purple-600 text-white text-xs font-bold">{pendingCount}</span>
                                )}
                            </CardTitle>
                            <CardDescription>Applications recommended by officers awaiting your final decision</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {signoffLoading ? (
                        <div className="flex items-center gap-2 py-4 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Loading...</span>
                        </div>
                    ) : pendingApps.length === 0 ? (
                        <p className="text-muted-foreground text-sm text-center py-6">No applications pending sign-off</p>
                    ) : (
                        <div className="space-y-3">
                            {pendingApps.map((app: any) => {
                                const isConfirming = confirming?.id === app.id;
                                return (
                                    <div key={app.id} className="border rounded-lg p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-0.5 min-w-0">
                                                <p className="font-medium text-sm">{app.permitType}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {app.applicant?.name} · {app.location}
                                                </p>
                                                {app.officer && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Recommended by {app.officer.name}
                                                    </p>
                                                )}
                                            </div>
                                            {!isConfirming && (
                                                <div className="flex gap-2 shrink-0">
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-600 hover:bg-green-700 h-8"
                                                        onClick={() => setConfirming({ id: app.id, decision: "APPROVE" })}
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        className="h-8"
                                                        onClick={() => setConfirming({ id: app.id, decision: "REJECT" })}
                                                    >
                                                        <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                                        Reject
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        {confirming?.id === app.id && confirming && (
                                            <div className="mt-3 pt-3 border-t space-y-2">
                                                <p className="text-xs font-medium text-muted-foreground">
                                                    {confirming.decision === "APPROVE" ? "Confirm approval" : "Confirm rejection"}
                                                </p>
                                                <input
                                                    type="text"
                                                    placeholder="Add a note (optional)"
                                                    value={signoffNotes[app.id] || ""}
                                                    onChange={e => setSignoffNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                                                    className="w-full px-3 py-1.5 text-sm border rounded-md bg-background"
                                                    autoFocus
                                                />
                                                <div className="flex gap-2">
                                                    {(() => {
                                                        const c = confirming;
                                                        return (
                                                    <Button
                                                        size="sm"
                                                        className={c.decision === "APPROVE" ? "bg-green-600 hover:bg-green-700" : ""}
                                                        variant={c.decision === "REJECT" ? "destructive" : "default"}
                                                        disabled={signoffMutation.isPending}
                                                        onClick={async () => {
                                                            try {
                                                                await signoffMutation.mutateAsync({ id: app.id, decision: c.decision, notes: signoffNotes[app.id] });
                                                                toast.success(c.decision === "APPROVE" ? "Application approved" : "Application rejected");
                                                                setConfirming(null);
                                                                setSignoffNotes(prev => { const n = { ...prev }; delete n[app.id]; return n; });
                                                            } catch { toast.error("Action failed"); }
                                                        }}
                                                    >
                                                        {signoffMutation.isPending ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : c.decision === "APPROVE" ? (
                                                            "Confirm Approval"
                                                        ) : (
                                                            "Confirm Rejection"
                                                        )}
                                                    </Button>
                                                        );
                                                    })()}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setConfirming(null)}
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* User Management Table */}
            <Card>
                <CardHeader>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Manage user roles and permissions</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Joined</TableHead>
                                <TableHead className="text-right">Applications</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.name}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        <Select
                                            value={user.role}
                                            onValueChange={(val) => {
                                                if (val) handleRoleChange(user.id, val);
                                            }}
                                            disabled={user.id === session?.user?.id}
                                        >
                                            <SelectTrigger className="w-[130px] h-8">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="APPLICANT">Applicant</SelectItem>
                                                <SelectItem value="OFFICER">Officer</SelectItem>
                                                <SelectItem value="ADMIN">Admin</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-sm capitalize">{user.department?.toLowerCase().replace('_', ' ') || 'General'}</TableCell>
                                    <TableCell>{formatDateTime(user.createdAt)}</TableCell>
                                    <TableCell className="text-right">
                                        {user._count.applications}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
