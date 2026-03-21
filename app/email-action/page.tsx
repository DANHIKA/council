"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const RESULTS: Record<
    string,
    {
        icon: React.ReactNode;
        title: string;
        description: string;
        variant: "success" | "error" | "warning" | "info";
    }
> = {
    recommended: {
        icon: <CheckCircle2 className="h-10 w-10 text-purple-500" />,
        title: "Approval Recommended",
        description: "Your recommendation has been submitted. Administrators have been notified for final sign-off.",
        variant: "info",
    },
    approved: {
        icon: <CheckCircle2 className="h-10 w-10 text-green-500" />,
        title: "Application Approved",
        description:
            "The application has been approved and a certificate has been generated. The applicant has been notified.",
        variant: "success",
    },
    rejected: {
        icon: <XCircle className="h-10 w-10 text-red-500" />,
        title: "Application Rejected",
        description: "The application has been rejected. The applicant has been notified.",
        variant: "error",
    },
    corrections: {
        icon: <AlertCircle className="h-10 w-10 text-orange-500" />,
        title: "Corrections Requested",
        description: "The applicant has been asked to submit corrections.",
        variant: "warning",
    },
    used: {
        icon: <Info className="h-10 w-10 text-muted-foreground" />,
        title: "Link Already Used",
        description: "This action link has already been used. Each link can only be used once.",
        variant: "info",
    },
    expired: {
        icon: <Info className="h-10 w-10 text-muted-foreground" />,
        title: "Link Expired",
        description: "This action link has expired. Please log in to the portal to take action.",
        variant: "info",
    },
    invalid: {
        icon: <XCircle className="h-10 w-10 text-red-500" />,
        title: "Invalid Link",
        description: "This action link is not valid. It may have been removed or never existed.",
        variant: "error",
    },
    already_decided: {
        icon: <Info className="h-10 w-10 text-muted-foreground" />,
        title: "Already Decided",
        description: "This application has already been given a final decision.",
        variant: "info",
    },
    error: {
        icon: <XCircle className="h-10 w-10 text-red-500" />,
        title: "Something Went Wrong",
        description: "An error occurred. Please log in to the portal and take action there.",
        variant: "error",
    },
};

function EmailActionPageInner() {
    const searchParams = useSearchParams();
    const result = searchParams.get("result") || "error";
    const applicationId = searchParams.get("id");

    const config = RESULTS[result] || RESULTS.error;

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader className="pb-2">
                    <div className="flex justify-center mb-4">{config.icon}</div>
                    <CardTitle className="text-xl">{config.title}</CardTitle>
                    <CardDescription>{config.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {applicationId && (
                        <Button className="w-full" render={<Link href={`/applications/${applicationId}`} />}>
                            View Application
                        </Button>
                    )}
                    <Button variant="outline" className="w-full" render={<Link href="/officer/applications" />}>
                        Go to Review Queue
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

export default function EmailActionPage() {
    return (
        <Suspense>
            <EmailActionPageInner />
        </Suspense>
    );
}
