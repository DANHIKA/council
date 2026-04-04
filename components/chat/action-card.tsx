"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
            <Card className="mt-3 border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20">
                <CardContent className="pt-3 pb-3 px-4">
                    <div className="flex items-start gap-2">
                        <CheckCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-green-700 dark:text-green-400">
                                {action.label} — Done
                            </p>
                            {result && (
                                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                                    {result}
                                </p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Error
    if (status === "error") {
        return (
            <Card className="mt-3 border-destructive/30 bg-destructive/5">
                <CardContent className="pt-3 pb-3 px-4">
                    <div className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-destructive">Action failed</p>
                            {result && (
                                <p className="text-xs text-muted-foreground mt-1">{result}</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Pending / Loading
    return (
        <Card className="mt-3 border-border bg-muted/30">
            <CardContent className="pt-4 pb-4 px-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className={meta.color}>{meta.icon}</span>
                        <span className="text-sm font-semibold">{action.label}</span>
                    </div>
                    <Badge variant={meta.badgeVariant} className="text-[10px] font-medium">
                        Awaiting confirmation
                    </Badge>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed">
                    {action.description}
                </p>

                {/* Notes input */}
                {action.requiresNotes && status === "pending" && (
                    <Textarea
                        placeholder="Add notes (optional)..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className="text-xs resize-none"
                    />
                )}

                {/* Buttons */}
                <div className="flex gap-2 justify-end">
                    {status === "loading" ? (
                        <Button size="sm" className="h-7 text-xs" disabled>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Processing...
                        </Button>
                    ) : (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={onCancel}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={handleConfirm}
                                disabled={internalLoading}
                            >
                                {action.type === "navigate" ? (
                                    <ArrowRight className="h-3 w-3 mr-1" />
                                ) : (
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                )}
                                {meta.confirmLabel}
                            </Button>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export { executeAction };
