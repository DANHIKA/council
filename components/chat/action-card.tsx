"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    CheckCircle2,
    XCircle,
    AlertCircle,
    UserPlus,
    Shield,
    ShieldX,
    FileText,
    ArrowRight,
    Loader2,
    CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActionType =
    | "officer_approve"
    | "officer_reject"
    | "officer_corrections"
    | "officer_assign"
    | "admin_signoff"
    | "admin_reject_final"
    | "summarize"
    | "navigate";

export interface ProposedAction {
    type: ActionType;
    label: string;
    description: string;
    applicationId?: string;
    requiresNotes?: boolean;
    href?: string;
}

export interface ActionState {
    proposal: ProposedAction;
    status: "pending" | "loading" | "done" | "error" | "cancelled";
    result?: string;
}

// ── Meta ──────────────────────────────────────────────────────────────────────

const ACTION_META: Record<
    ActionType,
    {
        icon: React.ReactNode;
        color: string;
        confirmLabel: string;
        badgeVariant: "default" | "secondary" | "destructive" | "outline";
    }
> = {
    officer_approve:    { icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-600",     confirmLabel: "Confirm Approval",    badgeVariant: "default" },
    officer_reject:     { icon: <XCircle className="h-4 w-4" />,      color: "text-destructive",    confirmLabel: "Confirm Rejection",   badgeVariant: "destructive" },
    officer_corrections:{ icon: <AlertCircle className="h-4 w-4" />,  color: "text-yellow-600",     confirmLabel: "Request Corrections", badgeVariant: "secondary" },
    officer_assign:     { icon: <UserPlus className="h-4 w-4" />,     color: "text-blue-600",       confirmLabel: "Assign to Me",        badgeVariant: "secondary" },
    admin_signoff:      { icon: <Shield className="h-4 w-4" />,       color: "text-green-600",      confirmLabel: "Sign Off & Approve",  badgeVariant: "default" },
    admin_reject_final: { icon: <ShieldX className="h-4 w-4" />,      color: "text-destructive",    confirmLabel: "Sign Off & Reject",   badgeVariant: "destructive" },
    summarize:          { icon: <FileText className="h-4 w-4" />,     color: "text-blue-600",       confirmLabel: "Generate Summary",    badgeVariant: "secondary" },
    navigate:           { icon: <ArrowRight className="h-4 w-4" />,   color: "text-primary",        confirmLabel: "Go",                  badgeVariant: "outline" },
};

// ── Execution ─────────────────────────────────────────────────────────────────

async function executeAction(action: ProposedAction, notes?: string): Promise<string> {
    const { type, applicationId } = action;

    switch (type) {
        case "officer_approve":
            await fetchOrThrow(`/api/officer/applications/${applicationId}/decision`, {
                method: "POST",
                body: { decision: "APPROVE", notes },
            });
            return "Application recommended for approval. Admins have been notified for sign-off.";

        case "officer_reject":
            await fetchOrThrow(`/api/officer/applications/${applicationId}/decision`, {
                method: "POST",
                body: { decision: "REJECT", notes },
            });
            return "Application rejected. The applicant has been notified.";

        case "officer_corrections":
            await fetchOrThrow(`/api/officer/applications/${applicationId}/decision`, {
                method: "POST",
                body: { decision: "REQUIRES_CORRECTION", notes },
            });
            return "Corrections requested. The applicant has been notified.";

        case "officer_assign":
            await fetchOrThrow(`/api/officer/applications/${applicationId}/assign`, {
                method: "POST",
                body: {},
            });
            return "Application assigned to you.";

        case "admin_signoff":
            await fetchOrThrow(`/api/admin/applications/${applicationId}/signoff`, {
                method: "POST",
                body: { decision: "APPROVE", notes },
            });
            return "Application approved and certificate generated. The applicant has been notified.";

        case "admin_reject_final":
            await fetchOrThrow(`/api/admin/applications/${applicationId}/signoff`, {
                method: "POST",
                body: { decision: "REJECT", notes },
            });
            return "Application rejected at sign-off. The applicant has been notified.";

        case "summarize": {
            const res = await fetchOrThrow("/api/ai/summarize-application", {
                method: "POST",
                body: { applicationId },
            });
            return res.summary ?? "Summary generated.";
        }

        case "navigate":
            return "Navigating...";

        default:
            throw new Error("Unknown action type");
    }
}

async function fetchOrThrow(
    url: string,
    opts: { method: string; body: Record<string, any> }
): Promise<any> {
    const res = await fetch(url, {
        method: opts.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts.body),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
    }
    return res.json().catch(() => ({}));
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ActionCardProps {
    action: ProposedAction;
    status: ActionState["status"];
    result?: string;
    onConfirm: (notes?: string) => void;
    onCancel: () => void;
}

export function ActionCard({
    action,
    status,
    result,
    onConfirm,
    onCancel,
}: ActionCardProps) {
    const [notes, setNotes] = useState("");
    const [internalLoading, setInternalLoading] = useState(false);
    const router = useRouter();
    const meta = ACTION_META[action.type];

    const handleConfirm = async () => {
        if (action.type === "navigate") {
            onConfirm();
            if (action.href) router.push(action.href);
            return;
        }
        setInternalLoading(true);
        onConfirm(notes || undefined);
    };

    // Cancelled
    if (status === "cancelled") {
        return (
            <p className="mt-2 text-xs text-muted-foreground italic">Action cancelled.</p>
        );
    }

    // Done
    if (status === "done") {
        return (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20 px-3 py-2">
                <CheckCheck className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                <div>
                    <p className="text-xs font-medium text-green-700 dark:text-green-400">{action.label} — Done</p>
                    {result && <p className="text-[11px] text-muted-foreground mt-0.5">{result}</p>}
                </div>
            </div>
        );
    }

    // Error
    if (status === "error") {
        return (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                <div>
                    <p className="text-xs font-medium text-destructive">Action failed</p>
                    {result && <p className="text-[11px] text-muted-foreground mt-0.5">{result}</p>}
                </div>
            </div>
        );
    }

    // Pending / Loading
    return (
        <div className="mt-2 rounded-lg border bg-muted/20 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2">
                <span className={cn("shrink-0", meta.color)}>{meta.icon}</span>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-tight">{action.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{action.description}</p>
                </div>
                {status === "loading" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                ) : (
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={onCancel}
                            className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
                        >
                            Dismiss
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={internalLoading}
                            className={cn(
                                "text-[11px] font-medium px-2.5 py-1 rounded transition-colors",
                                meta.badgeVariant === "destructive"
                                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                            )}
                        >
                            {meta.confirmLabel}
                        </button>
                    </div>
                )}
            </div>

            {action.requiresNotes && status === "pending" && (
                <div className="border-t px-3 pb-2 pt-1.5">
                    <textarea
                        placeholder="Add notes (optional)..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className="w-full text-xs bg-transparent resize-none outline-none placeholder:text-muted-foreground"
                    />
                </div>
            )}
        </div>
    );
}

export { executeAction };
