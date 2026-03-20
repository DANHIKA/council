"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Loader2, Users, Shield, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";
import { adminApi, type AdminUser } from "@/lib/services/admin";
import { usePermissions } from "@/hooks/usePermissions";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

const CHART_COLORS = ["#22c55e", "#3b82f6", "#ef4444", "#f59e0b"];

export default function AdminPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);

    const { isAdmin } = usePermissions();

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

    // Chart data
    const userDistribution = [
        { name: "Applicants", value: totalApplicants, fill: CHART_COLORS[0] },
        { name: "Officers", value: totalOfficers, fill: CHART_COLORS[1] },
        { name: "Admins", value: totalAdmins, fill: CHART_COLORS[2] },
    ];

    const applicationsPerUser = users
        .filter(u => u._count.applications > 0)
        .slice(0, 10)
        .map(u => ({
            name: u.name?.split(" ")[0] || "Unknown",
            applications: u._count.applications,
        }));

    const chartConfig = {
        applicants: { label: "Applicants", color: CHART_COLORS[0] },
        officers: { label: "Officers", color: CHART_COLORS[1] },
        admins: { label: "Admins", color: CHART_COLORS[2] },
        applications: { label: "Applications", color: CHART_COLORS[3] },
    };

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

            {/* Charts */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* User Distribution Pie Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>User Distribution</CardTitle>
                        <CardDescription>Breakdown of users by role</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfig} className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={userDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {userDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<ChartTooltipContent />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                        <div className="flex justify-center gap-4 mt-4">
                            {userDistribution.map((item) => (
                                <div key={item.name} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                                    <span className="text-sm text-muted-foreground">{item.name}: {item.value}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Applications per User Bar Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Top Users by Applications</CardTitle>
                        <CardDescription>Most active applicants</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {applicationsPerUser.length === 0 ? (
                            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                                No applications yet
                            </div>
                        ) : (
                            <ChartContainer config={chartConfig} className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={applicationsPerUser} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" allowDecimals={false} />
                                        <YAxis dataKey="name" type="category" width={80} />
                                        <Tooltip content={<ChartTooltipContent />} />
                                        <Bar dataKey="applications" fill="var(--color-applications)" radius={4} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

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
