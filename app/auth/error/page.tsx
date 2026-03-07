"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

export default function AuthErrorPage() {
    const router = useRouter();

    useEffect(() => {
        const timer = setTimeout(() => {
            router.push("/auth/login");
        }, 5000);
        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <CardTitle className="text-2xl">Authentication Error</CardTitle>
                    <CardDescription>
                        There was a problem signing you in. You will be redirected to the login page.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <Button asChild>
                        <Link href="/auth/login">Return to Login</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
