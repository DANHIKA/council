"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Loader2, Wallet, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import {
    PaymentMethodCard,
    AddPaymentMethodDialog,
    WithdrawalCard,
    RequestWithdrawalDialog,
    WithdrawalSummaryCards,
} from "@/components/withdrawal";
import { withdrawalApi } from "@/lib/services/withdrawal";
import { PaymentMethod, Withdrawal, WithdrawalSummary } from "@/lib/types/withdrawal";

export default function WithdrawalsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { isAdmin } = usePermissions();

    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [summary, setSummary] = useState<WithdrawalSummary>({
        totalWithdrawn: 0,
        pendingWithdrawals: 0,
        completedWithdrawals: 0,
        availableBalance: 0,
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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

        fetchData();
    }, [session, status, isAdmin, router]);

    const fetchData = async () => {
        setRefreshing(true);
        try {
            const [methodsRes, withdrawalsRes] = await Promise.all([
                withdrawalApi.getPaymentMethods(),
                withdrawalApi.getWithdrawals(),
            ]);
            setPaymentMethods(methodsRes.data);
            setWithdrawals(withdrawalsRes.data);
            setSummary(withdrawalsRes.summary);
        } catch (error: any) {
            console.error("Failed to fetch data:", error);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
            setRefreshing(false);
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

    return (
        <div className="container mx-auto py-8 max-w-7xl space-y-8">
            <div className="flex justify-end">
                <Button
                    variant="outline"
                    onClick={() => fetchData()}
                    disabled={refreshing}
                >
                    {refreshing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <Wallet className="h-4 w-4 mr-2" />
                    )}
                    Refresh
                </Button>
            </div>

            {/* Summary Cards */}
            <WithdrawalSummaryCards summary={summary} />

            <Tabs defaultValue="withdrawals" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="withdrawals">
                        <Wallet className="h-4 w-4 mr-2" />
                        Withdrawals
                    </TabsTrigger>
                    <TabsTrigger value="payment-methods">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Payment Methods
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="withdrawals" className="space-y-4">
                    <div className="flex justify-end">
                        <RequestWithdrawalDialog
                            paymentMethods={paymentMethods}
                            onSuccess={() => fetchData()}
                        />
                    </div>

                    {withdrawals.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="py-12 text-center">
                                <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                                <h3 className="text-lg font-medium mb-1">No withdrawals yet</h3>
                                <p className="text-muted-foreground mb-4">
                                    Request your first withdrawal to get started
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {withdrawals.map((withdrawal) => (
                                <WithdrawalCard
                                    key={withdrawal.id}
                                    withdrawal={withdrawal}
                                    onUpdate={() => fetchData()}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="payment-methods" className="space-y-4">
                    <div className="flex justify-end">
                        <AddPaymentMethodDialog onSuccess={() => fetchData()} />
                    </div>

                    {paymentMethods.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="py-12 text-center">
                                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                                <h3 className="text-lg font-medium mb-1">No payment methods yet</h3>
                                <p className="text-muted-foreground mb-4">
                                    Add a bank account or mobile money number for withdrawals
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {paymentMethods.map((method) => (
                                <PaymentMethodCard
                                    key={method.id}
                                    method={method}
                                    onUpdate={() => fetchData()}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
