"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PaymentMethod, WithdrawalMethodType } from "@/lib/types/withdrawal";
import { toast } from "sonner";
import { Loader2, Plus, Building2, Phone, Trash2, Star } from "lucide-react";

interface PaymentMethodCardProps {
    method: PaymentMethod;
    onUpdate: () => void;
}

export function PaymentMethodCard({ method, onUpdate }: PaymentMethodCardProps) {
    const [deleting, setDeleting] = useState(false);
    const [updating, setUpdating] = useState(false);

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this payment method?")) return;

        setDeleting(true);
        try {
            await withdrawalApi.deletePaymentMethod(method.id);
            toast.success("Payment method deleted");
            onUpdate();
        } catch (error: any) {
            toast.error(error.message || "Failed to delete payment method");
        } finally {
            setDeleting(false);
        }
    };

    const handleToggleDefault = async () => {
        setUpdating(true);
        try {
            await withdrawalApi.updatePaymentMethod(method.id, {
                isDefault: !method.isDefault,
            });
            toast.success("Payment method updated");
            onUpdate();
        } catch (error: any) {
            toast.error(error.message || "Failed to update payment method");
        } finally {
            setUpdating(false);
        }
    };

    const handleToggleActive = async () => {
        setUpdating(true);
        try {
            await withdrawalApi.updatePaymentMethod(method.id, {
                isActive: !method.isActive,
            });
            toast.success(method.isActive ? "Payment method deactivated" : "Payment method activated");
            onUpdate();
        } catch (error: any) {
            toast.error(error.message || "Failed to update payment method");
        } finally {
            setUpdating(false);
        }
    };

    const details = method.details as any;
    const Icon = method.type === "BANK_ACCOUNT" ? Building2 : Phone;

    return (
        <Card className="relative">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                {method.type === "BANK_ACCOUNT" ? "Bank Account" : "Mobile Money"}
                                {method.isDefault && (
                                    <Badge variant="secondary" className="text-xs">
                                        Default
                                    </Badge>
                                )}
                                {!method.isActive && (
                                    <Badge variant="outline" className="text-xs">
                                        Inactive
                                    </Badge>
                                )}
                            </CardTitle>
                            <CardDescription className="mt-1">
                                {method.type === "BANK_ACCOUNT" ? (
                                    <span>{details.bankName} •••• {details.accountNumber?.slice(-4)}</span>
                                ) : (
                                    <span>{details.network} • {details.phoneNumber}</span>
                                )}
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleToggleDefault}
                            disabled={updating}
                            title={method.isDefault ? "Remove default" : "Set as default"}
                        >
                            <Star className={`h-4 w-4 ${method.isDefault ? "fill-current text-yellow-500" : ""}`} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleToggleActive}
                            disabled={updating}
                            title={method.isActive ? "Deactivate" : "Activate"}
                        >
                            {method.isActive ? "Disable" : "Enable"}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDelete}
                            disabled={deleting}
                            className="text-destructive hover:text-destructive"
                        >
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </CardHeader>
        </Card>
    );
}

interface AddPaymentMethodDialogProps {
    onSuccess: () => void;
}

export function AddPaymentMethodDialog({ onSuccess }: AddPaymentMethodDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [type, setType] = useState<WithdrawalMethodType>("BANK_ACCOUNT");

    // Bank details
    const [bankName, setBankName] = useState("");
    const [accountName, setAccountName] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [branchCode, setBranchCode] = useState("");

    // Mobile money details
    const [network, setNetwork] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [mobileAccountName, setMobileAccountName] = useState("");

    const [isDefault, setIsDefault] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (type === "BANK_ACCOUNT" && (!bankName || !accountName || !accountNumber)) {
            toast.error("Please fill in all required bank details");
            return;
        }

        if (type === "MOBILE_MONEY" && (!network || !phoneNumber || !mobileAccountName)) {
            toast.error("Please fill in all required mobile money details");
            return;
        }

        setLoading(true);

        const details = type === "BANK_ACCOUNT"
            ? { bankName, accountName, accountNumber, ...(branchCode && { branchCode }) }
            : { network, phoneNumber, accountName: mobileAccountName };

        try {
            await withdrawalApi.createPaymentMethod({
                type,
                details,
                isDefault,
            });
            toast.success("Payment method added");
            setOpen(false);
            resetForm();
            onSuccess();
        } catch (error: any) {
            toast.error(error.message || "Failed to add payment method");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setBankName("");
        setAccountName("");
        setAccountNumber("");
        setBranchCode("");
        setNetwork("");
        setPhoneNumber("");
        setMobileAccountName("");
        setIsDefault(false);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => {
            setOpen(o);
            if (!o) resetForm();
        }}>
            <DialogTrigger>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Payment Method
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add Payment Method</DialogTitle>
                    <DialogDescription>
                        Add a bank account or mobile money number for withdrawals
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Payment Type</Label>
                        <Select value={type} onValueChange={(v) => setType(v as WithdrawalMethodType)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="BANK_ACCOUNT">Bank Account</SelectItem>
                                <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {type === "BANK_ACCOUNT" ? (
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor="bankName">Bank Name</Label>
                                <Input
                                    id="bankName"
                                    value={bankName}
                                    onChange={(e) => setBankName(e.target.value)}
                                    placeholder="e.g., National Bank of Malawi"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="accountName">Account Name</Label>
                                <Input
                                    id="accountName"
                                    value={accountName}
                                    onChange={(e) => setAccountName(e.target.value)}
                                    placeholder="Name on the account"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="accountNumber">Account Number</Label>
                                <Input
                                    id="accountNumber"
                                    value={accountNumber}
                                    onChange={(e) => setAccountNumber(e.target.value)}
                                    placeholder="Account number"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="branchCode">Branch Code (Optional)</Label>
                                <Input
                                    id="branchCode"
                                    value={branchCode}
                                    onChange={(e) => setBranchCode(e.target.value)}
                                    placeholder="Branch/sort code"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor="network">Network</Label>
                                <Input
                                    id="network"
                                    value={network}
                                    onChange={(e) => setNetwork(e.target.value)}
                                    placeholder="e.g., TNM Mpamba, Airtel Money"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phoneNumber">Phone Number</Label>
                                <Input
                                    id="phoneNumber"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    placeholder="+265..."
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mobileAccountName">Account Name</Label>
                                <Input
                                    id="mobileAccountName"
                                    value={mobileAccountName}
                                    onChange={(e) => setMobileAccountName(e.target.value)}
                                    placeholder="Name registered on mobile money"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="isDefault"
                            checked={isDefault}
                            onChange={(e) => setIsDefault(e.target.checked)}
                            className="h-4 w-4 rounded"
                        />
                        <Label htmlFor="isDefault" className="text-sm font-normal">
                            Set as default payment method
                        </Label>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Add Payment Method
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
