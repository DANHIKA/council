"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface PaymentCardProps {
    applicationId: string;
    paymentStatus: "PENDING" | "PAID" | "FAILED" | "WAIVED";
    fee: number;
    currency: string;
}

const STATUS_CONFIG = {
    PAID: {
        label: "Payment confirmed",
        icon: CheckCircle2,
        className: "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800",
        badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    },
    WAIVED: {
        label: "No fee required",
        icon: CheckCircle2,
        className: "border-muted bg-muted/20",
        badge: "bg-muted text-muted-foreground",
    },
    FAILED: {
        label: "Payment failed",
        icon: XCircle,
        className: "border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800",
        badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
    PENDING: {
        label: "Payment required",
        icon: AlertCircle,
        className: "border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800",
        badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    },
} as const;

export function PaymentCard({ applicationId, paymentStatus, fee, currency }: PaymentCardProps) {
    const [loading, setLoading] = useState(false);

    const config = STATUS_CONFIG[paymentStatus];
    const Icon = config.icon;
    const isPending = paymentStatus === "PENDING";
    const isFailed = paymentStatus === "FAILED";
    const showPayButton = isPending || isFailed;

    const handlePay = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/payments/initiate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ applicationId }),
            });
            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error ?? "Failed to initiate payment");
                return;
            }

            if (data.waived) {
                toast.success("No fee required — application is free.");
                window.location.reload();
                return;
            }

            // Redirect to Paychangu hosted checkout
            window.location.href = data.checkoutUrl;
        } catch {
            toast.error("Could not start payment. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className={config.className}>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    Application fee
                    <Badge className={`ml-auto text-xs ${config.badge}`}>
                        {config.label}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div>
                    <p className="text-2xl font-bold">
                        {currency} {Number(fee).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    {isPending && (
                        <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                            Payment is required before your application can be processed.
                        </p>
                    )}
                    {isFailed && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            Your last payment attempt failed. Please try again.
                        </p>
                    )}
                    {paymentStatus === "PAID" && (
                        <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                            Payment received. Your application is being reviewed.
                        </p>
                    )}
                </div>

                {showPayButton && (
                    <Button
                        onClick={handlePay}
                        disabled={loading}
                        className="w-full"
                        variant={isFailed ? "destructive" : "default"}
                    >
                        {loading ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecting…</>
                        ) : (
                            <><CreditCard className="h-4 w-4 mr-2" />{isFailed ? "Retry payment" : "Pay now"}</>
                        )}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}