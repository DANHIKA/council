"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/useSession";
import { useRouter } from "next/navigation";
import { http } from "@/lib/services/http";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft, CreditCard, CheckCircle2, Clock, XCircle, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";

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
    updatedAt: string;
    application: {
        id: string;
        permitType: string;
        status: string;
    };
}

interface TransactionsResponse {
    data: Transaction[];
    pagination: { page: number; limit: number; total: number; pages: number };
    summary: { totalPaid: number; totalPending: number; totalFailed: number; count: number };
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

export default function TransactionsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [page, setPage] = useState(1);

    const queryParams = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter !== "ALL") queryParams.set("status", statusFilter);

    const { data, isLoading } = useQuery<TransactionsResponse>({
        queryKey: ["transactions", statusFilter, page],
        queryFn: () => http.get(`/api/transactions?${queryParams}`),
        enabled: !!session,
        placeholderData: (prev) => prev,
    });

    if (status === "loading") return null;
    if (!session) { router.push("/auth/login"); return null; }

    const transactions = data?.data ?? [];
    const summary = data?.summary;
    const pagination = data?.pagination;

    return (
        <div className="container mx-auto py-8 max-w-5xl space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" render={<Link href="/dashboard" />} className="rounded-full h-10 w-10">
                    <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">My Transactions</h1>
                    <p className="text-muted-foreground text-sm">Your payment history for all permit applications</p>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">
                                    {summary ? `MWK ${Number(summary.totalPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
                                </p>
                                <p className="text-sm text-muted-foreground">Total Paid</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-yellow-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">
                                    {summary ? `MWK ${Number(summary.totalPending).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
                                </p>
                                <p className="text-sm text-muted-foreground">Pending</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <CreditCard className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{summary?.count ?? "—"}</p>
                                <p className="text-sm text-muted-foreground">Total Transactions</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Transaction History</CardTitle>
                        <CardDescription>All payments linked to your applications</CardDescription>
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
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : transactions.length === 0 ? (
                        <EmptyState
                            title="No transactions yet"
                            description="Payments for your permit applications will appear here."
                        />
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Permit Type</TableHead>
                                        <TableHead>Reference</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Application</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map(tx => (
                                        <TableRow key={tx.id}>
                                            <TableCell className="font-medium">{tx.application.permitType}</TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{tx.txRef}</TableCell>
                                            <TableCell className="font-semibold">
                                                {tx.currency} {Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell>{statusBadge(tx.status)}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{formatDateTime(tx.createdAt)}</TableCell>
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
