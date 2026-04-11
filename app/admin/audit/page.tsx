"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const ENTITY_COLORS: Record<string, string> = {
    APPLICATION: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    USER: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    PERMIT_TYPE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    WITHDRAWAL: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    CERTIFICATE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

const ACTION_COLORS: Record<string, string> = {
    CREATE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    APPROVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    REJECT: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

interface AuditLog {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    description?: string;
    metadata?: any;
    createdAt: string;
    user: {
        id: string;
        name: string | null;
        email: string;
        role: string;
    };
}

export default function AdminAuditPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [entityFilter, setEntityFilter] = useState<string>("");
    const [actionFilter, setActionFilter] = useState<string>("");

    useEffect(() => {
        if (status === "loading") return;
        if (!session || (session.user as any)?.role !== "ADMIN") {
            router.push("/dashboard");
            return;
        }
        loadLogs();
    }, [status, session, page, entityFilter, actionFilter]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: "50",
                ...(entityFilter && { entityType: entityFilter }),
                ...(actionFilter && { action: actionFilter }),
            });
            const res = await fetch(`/api/admin/audit-log?${params}`);
            if (!res.ok) throw new Error("Failed to load");
            const data = await res.json();
            setLogs(data.data);
            setTotalPages(data.pagination.pages);
            setTotal(data.pagination.total);
        } catch {
            toast.error("Failed to load audit log");
        } finally {
            setLoading(false);
        }
    };

    if (status === "loading" || !session) return null;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Audit Log</h2>
                <p className="text-muted-foreground mt-1">
                    Track all admin actions across the system
                </p>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs">Entity Type</Label>
                            <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v || ""); setPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All</SelectItem>
                                    <SelectItem value="APPLICATION">Applications</SelectItem>
                                    <SelectItem value="USER">Users</SelectItem>
                                    <SelectItem value="PERMIT_TYPE">Permit Types</SelectItem>
                                    <SelectItem value="WITHDRAWAL">Withdrawals</SelectItem>
                                    <SelectItem value="CERTIFICATE">Certificates</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Action</Label>
                            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v || ""); setPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All</SelectItem>
                                    <SelectItem value="CREATE">Create</SelectItem>
                                    <SelectItem value="UPDATE">Update</SelectItem>
                                    <SelectItem value="DELETE">Delete</SelectItem>
                                    <SelectItem value="APPROVE">Approve</SelectItem>
                                    <SelectItem value="REJECT">Reject</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setEntityFilter(""); setActionFilter(""); setPage(1); }}
                                className="w-full"
                            >
                                Clear Filters
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{total} total entries</span>
            </div>

            {/* Log Table */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : logs.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        No audit log entries found
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {logs.map((log) => (
                                <div key={log.id} className="p-4 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-start gap-3">
                                        <div className="flex items-center gap-2 shrink-0 mt-0.5">
                                            <Badge className={ACTION_COLORS[log.action] ?? "bg-muted text-muted-foreground"}>
                                                {log.action}
                                            </Badge>
                                            <Badge variant="outline" className={ENTITY_COLORS[log.entityType] ?? ""}>
                                                {log.entityType}
                                            </Badge>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm">{log.description || `${log.action} on ${log.entityType}`}</p>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                <span>{log.user.name || log.user.email}</span>
                                                <span>·</span>
                                                <span>{log.user.role}</span>
                                                <span>·</span>
                                                <span>ID: {log.entityId.slice(-8)}</span>
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground shrink-0">
                                            {formatDateTime(log.createdAt)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
