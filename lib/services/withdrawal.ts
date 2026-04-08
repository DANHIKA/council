import { PaymentMethod, Withdrawal, WithdrawalSummary } from "@/lib/types/withdrawal";

const API_BASE = "/api/admin";

export interface PaymentMethodInput {
    type: "BANK_ACCOUNT" | "MOBILE_MONEY";
    details: {
        bankName?: string;
        accountName?: string;
        accountNumber?: string;
        branchCode?: string;
        swiftCode?: string;
        network?: string;
        phoneNumber?: string;
    };
    isDefault?: boolean;
}

export const withdrawalApi = {
    async getPaymentMethods(): Promise<{ data: PaymentMethod[] }> {
        const res = await fetch(`${API_BASE}/payment-methods`);
        if (!res.ok) throw new Error("Failed to fetch payment methods");
        return res.json();
    },

    async createPaymentMethod(data: PaymentMethodInput): Promise<{ data: PaymentMethod }> {
        const res = await fetch(`${API_BASE}/payment-methods`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Failed to create payment method");
        }
        return res.json();
    },

    async updatePaymentMethod(
        id: string,
        data: Partial<{ details: any; isDefault: boolean; isActive: boolean }>
    ): Promise<{ data: PaymentMethod }> {
        const res = await fetch(`${API_BASE}/payment-methods/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Failed to update payment method");
        }
        return res.json();
    },

    async deletePaymentMethod(id: string): Promise<void> {
        const res = await fetch(`${API_BASE}/payment-methods/${id}`, {
            method: "DELETE",
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Failed to delete payment method");
        }
    },

    async getWithdrawals(status?: string): Promise<{
        data: Withdrawal[];
        summary: WithdrawalSummary;
    }> {
        const url = status ? `${API_BASE}/withdrawals?status=${status}` : `${API_BASE}/withdrawals`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch withdrawals");
        return res.json();
    },

    async createWithdrawal(data: {
        amount: number;
        paymentMethodId: string;
        notes?: string;
    }): Promise<{ data: Withdrawal }> {
        const res = await fetch(`${API_BASE}/withdrawals`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Failed to create withdrawal");
        }
        return res.json();
    },

    async updateWithdrawal(
        id: string,
        data: { status?: string; reference?: string; notes?: string }
    ): Promise<{ data: Withdrawal }> {
        const res = await fetch(`${API_BASE}/withdrawals/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Failed to update withdrawal");
        }
        return res.json();
    },
};
