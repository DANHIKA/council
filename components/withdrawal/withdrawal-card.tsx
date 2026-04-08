"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { withdrawalApi } from "@/lib/services/withdrawal";
import { PaymentMethod, Withdrawal } from "@/lib/types/withdrawal";
import { toast } from "sonner";
import { Loader2, Plus, Wallet, ArrowUpRight, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    PROCESSING: "bg-blue-100 text-blue-800",
    COMPLETED: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
    CANCELLED: "bg-gray-100 text-gray-800",
};

interface WithdrawalCardProps {
    withdrawal: Withdrawal;
    onUpdate: () => void;
}

export function WithdrawalCard({ withdrawal, onUpdate }: WithdrawalCardProps) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-primary" />
                            MK {withdrawal.amount.toLocaleString()}
                        </CardTitle>
                        <CardDescription>
                            {withdrawal.paymentMethod?.type === "BANK_ACCOUNT" ? "Bank Transfer" : "Mobile Money"}
                        </CardDescription>
                    </div>
                    <Badge className={statusColors[withdrawal.status]}>
                        {withdrawal.status}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Created: {format(new Date(withdrawal.createdAt), "dd MMM yyyy, HH:mm")}</span>
                    </div>
                    {withdrawal.processedAt && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Processed: {format(new Date(withdrawal.processedAt), "dd MMM yyyy, HH:mm")}</span>
                        </div>
                    )}
                    {withdrawal.reference && (
                        <div className="text-muted-foreground">
                            Reference: <span className="font-mono">{withdrawal.reference}</span>
                        </div>
                    )}
                    {withdrawal.notes && (
                        <div className="text-muted-foreground">
                            Notes: {withdrawal.notes}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

interface RequestWithdrawalDialogProps {
    paymentMethods: PaymentMethod[];
    onSuccess: () => void;
}

export function RequestWithdrawalDialog({ paymentMethods, onSuccess }: RequestWithdrawalDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [amount, setAmount] = useState("");
    const [paymentMethodId, setPaymentMethodId] = useState("");
    const [notes, setNotes] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        if (!paymentMethodId) {
            toast.error("Please select a payment method");
            return;
        }

        setLoading(true);

        try {
            await withdrawalApi.createWithdrawal({
                amount: numAmount,
                paymentMethodId,
                notes: notes || undefined,
            });
            toast.success("Withdrawal request created");
            setOpen(false);
            resetForm();
            onSuccess();
        } catch (error: any) {
            toast.error(error.message || "Failed to create withdrawal");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setAmount("");
        setPaymentMethodId("");
        setNotes("");
    };

    const defaultMethod = paymentMethods.find(m => m.isDefault);
    const activeMethods = paymentMethods.filter(m => m.isActive);

    if (activeMethods.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                    <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground mb-4">
                        Add a payment method first to request withdrawals
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Dialog open={open} onOpenChange={(o) => {
            setOpen(o);
            if (!o) resetForm();
        }}>
            <DialogTrigger>
                <Button className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Request Withdrawal
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Request Withdrawal</DialogTitle>
                    <DialogDescription>
                        Request to withdraw funds to your payment method
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount (MWK)</Label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <Select value={paymentMethodId} onValueChange={(v) => v && setPaymentMethodId(v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                            <SelectContent>
                                {activeMethods.map((method) => (
                                    <SelectItem key={method.id} value={method.id}>
                                        {method.type === "BANK_ACCOUNT" ? "Bank" : "Mobile"} - {method.isDefault ? "(Default) " : ""}{method.id.slice(-6)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Any additional notes..."
                            rows={3}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Request Withdrawal
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

interface WithdrawalSummaryProps {
    summary: {
        totalWithdrawn: number;
        pendingWithdrawals: number;
        completedWithdrawals: number;
        availableBalance: number;
    };
}

export function WithdrawalSummaryCards({ summary }: WithdrawalSummaryProps) {
    return (
        <div className="grid gap-4 md:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">MK {summary.availableBalance.toLocaleString()}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Withdrawn</CardTitle>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">MK {summary.totalWithdrawn.toLocaleString()}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summary.pendingWithdrawals}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completed</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summary.completedWithdrawals}</div>
                </CardContent>
            </Card>
        </div>
    );
}
