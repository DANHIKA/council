"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/useSession";
import { useRouter } from "next/navigation";
import { http } from "@/lib/services/http";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { formatDateTime } from "@/lib/utils";
import {
    CreditCard, CheckCircle2, Clock,
    XCircle, ExternalLink, TrendingUp, Search, Loader2,
} from "lucide-react";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";

type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "WAIVED";

interface Transaction {
    id: string;
    txRef: string;
    type: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    paychanguTxId: string | null;
    createdAt: string;
    application: {
        id: string;
        permitType: string;
        status: string;
        applicant: { id: string; name: string; email: string };
    };
}

interface AdminTransactionsResponse {
    data: Transaction[];
    pagination: { page: number; limit: number; total: number; pages: number };
    summary: {
        totalCollected: number;
        totalPending: number;
        totalFailed: number;
        countPaid: number;
        countPending: number;
        countTotal: number;
    };
}

function statusBadge(status: PaymentStatus) {
    switch (status) {
        case "PAID":
            return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100"><CheckCircle2 className="h-3 w-3 mr-1" />Paid</Badge>;
        case "PENDING":
            return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
        case "FAILED":
            return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
        case "WAIVED":
            return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">Waived</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
}

export default function AdminTransactionsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { isAdmin } = usePermissions();
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [page, setPage] = useState(1);

    const queryParams = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter !== "ALL") queryParams.set("status", statusFilter);
    if (search) queryParams.set("q", search);

    const { data, isLoading } = useQuery<AdminTransactionsResponse>({
        queryKey: ["admin", "transactions", statusFilter, search, page],
        queryFn: () => http.get(`/api/admin/transactions?${queryParams}`),
        enabled: !!session,
        placeholderData: (prev) => prev,
    });

    if (status === "loading") return null;
    if (!session || !isAdmin) { router.push("/dashboard"); return null; }

    const transactions = data?.data ?? [];
    const summary = data?.summary;
    const pagination = data?.pagination;

    const handleSearch = () => {
        setSearch(searchInput);
        setPage(1);
    };

    return (
        <div className="container mx-auto py-8 max-w-6xl space-y-6">

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                <TrendingUp className="h-5 w-5 text-green-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xl font-bold truncate">
                                    MWK {Number(summary?.totalCollected ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-sm text-muted-foreground">Total Collected</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                                <Clock className="h-5 w-5 text-yellow-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xl font-bold truncate">
                                    MWK {Number(summary?.totalPending ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-sm text-muted-foreground">Pending</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xl font-bold">{summary?.countPaid ?? 0}</p>
                                <p className="text-sm text-muted-foreground">Paid Transactions</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <CreditCard className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-xl font-bold">{summary?.countTotal ?? 0}</p>
                                <p className="text-sm text-muted-foreground">All Transactions</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Transaction History</CardTitle>
                            <CardDescription>Every payment record across all applicants</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Search applicant, ref…"
                                    className="w-48"
                                    value={searchInput}
                                    onChange={e => setSearchInput(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                                />
                                <Button variant="outline" size="icon" onClick={handleSearch}>
                                    <Search className="h-4 w-4" />
                                </Button>
                            </div>
                            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v ?? "ALL"); setPage(1); }}>
                                <SelectTrigger className="w-36">
                                    <SelectValue placeholder="Filter status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All statuses</SelectItem>
                                    <SelectItem value="PAID">Paid</SelectItem>
                                    <SelectItem value="PENDING">Pending</SelectItem>
                                    <SelectItem value="FAILED">Failed</SelectItem>
                                    <SelectItem value="WAIVED">Waived</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : transactions.length === 0 ? (
                        <EmptyState
                            title="No transactions found"
                            description="Applicant payments will appear here once made."
                        />
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Applicant</TableHead>
                                        <TableHead>Permit Type</TableHead>
                                        <TableHead>Reference</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">View</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map(tx => (
                                        <TableRow key={tx.id}>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-sm">{tx.application.applicant.name}</p>
                                                    <p className="text-xs text-muted-foreground">{tx.application.applicant.email}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">{tx.application.permitType}</TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{tx.txRef}</TableCell>
                                            <TableCell className="font-semibold">
                                                {tx.currency} {Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell>{statusBadge(tx.status)}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDateTime(tx.createdAt)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant="ghost" render={<Link href={`/applications/${tx.application.id}`} />}>
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {pagination && pagination.pages > 1 && (
                                <div className="flex items-center justify-between px-6 py-4 border-t">
                                    <p className="text-sm text-muted-foreground">
                                        Page {pagination.page} of {pagination.pages} — {pagination.total} transactions
                                    </p>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Previous</Button>
                                        <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= pagination.pages}>Next</Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
