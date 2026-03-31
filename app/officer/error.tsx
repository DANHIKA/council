"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

export default function OfficerError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[Officer section error]", error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center gap-6">
            <div className="rounded-full bg-destructive/10 p-5">
                <AlertTriangle className="h-10 w-10 text-destructive" />
            </div>
            <div className="space-y-1">
                <h1 className="text-2xl font-bold">Something went wrong</h1>
                <p className="text-muted-foreground max-w-md">
                    {error.message && error.message !== "Internal server error"
                        ? error.message
                        : "An unexpected error occurred while loading this page."}
                </p>
                {error.digest && (
                    <p className="text-xs text-muted-foreground font-mono mt-2">
                        Error ID: {error.digest}
                    </p>
                )}
            </div>
            <div className="flex gap-3">
                <Button variant="outline" onClick={() => window.location.href = "/officer/applications"}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Queue
                </Button>
                <Button onClick={reset}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try again
                </Button>
            </div>
        </div>
    );
}
