export type WithdrawalStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type WithdrawalMethodType = "BANK_ACCOUNT" | "MOBILE_MONEY";

export interface PaymentMethod {
    id: string;
    adminId: string;
    type: WithdrawalMethodType;
    details: BankDetails | MobileMoneyDetails;
    isDefault: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    withdrawals?: Withdrawal[];
}

export interface BankDetails {
    bankName: string;
    accountName: string;
    accountNumber: string;
    branchCode?: string;
    swiftCode?: string;
}

export interface MobileMoneyDetails {
    network: string;
    phoneNumber: string;
    accountName: string;
}

export interface Withdrawal {
    id: string;
    adminId: string;
    paymentMethodId: string;
    amount: number;
    currency: string;
    status: WithdrawalStatus;
    reference?: string;
    notes?: string;
    processedAt?: string;
    createdAt: string;
    updatedAt: string;
    paymentMethod?: PaymentMethod;
    admin?: {
        id: string;
        name: string;
        email: string;
    };
}

export interface WithdrawalSummary {
    totalWithdrawn: number;
    pendingWithdrawals: number;
    completedWithdrawals: number;
    availableBalance: number;
}
