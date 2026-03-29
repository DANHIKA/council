"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const DEMO_ACCOUNTS = [
    { role: "Applicant", email: "applicant@demo.local" },
    { role: "Officer",   email: "officer@demo.local" },
    { role: "Admin",     email: "admin@demo.local" },
];

function LoginPageInner() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (searchParams.get("registered") === "1") {
            setSuccessMessage("Account created! Please sign in.");
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const supabase = createSupabaseBrowserClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

        if (signInError) {
            setError("Invalid email or password.");
            setLoading(false);
        } else {
            router.push("/dashboard");
            router.refresh();
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Sign In</CardTitle>
                    <CardDescription>Council Permit Portal</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {successMessage && (
                            <Alert>
                                <AlertDescription>{successMessage}</AlertDescription>
                            </Alert>
                        )}
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>
                            ) : (
                                <><LogIn className="mr-2 h-4 w-4" />Sign In</>
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 border-t pt-4 space-y-2">
                        <p className="text-xs text-muted-foreground text-center">Demo accounts — click to fill</p>
                        {DEMO_ACCOUNTS.map(({ role, email: demoEmail }) => (
                            <button
                                key={role}
                                type="button"
                                disabled={loading}
                                onClick={() => { setEmail(demoEmail); setPassword("Password123!"); setError(null); }}
                                className="w-full flex justify-between items-center px-3 py-2 rounded-md text-xs border border-border hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                            >
                                <span className="font-medium">{role}</span>
                                <span className="text-muted-foreground font-mono">{demoEmail}</span>
                            </button>
                        ))}
                    </div>

                    <div className="text-center text-sm text-muted-foreground mt-2">
                        Don't have an account?{" "}
                        <Link href="/auth/register" className="text-primary hover:underline">
                            Create one
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginPageInner />
        </Suspense>
    );
}
