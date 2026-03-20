"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn } from "lucide-react";

const DEMO_ACCOUNTS = [
    { role: "Applicant", email: "applicant@demo.local" },
    { role: "Officer",   email: "officer@demo.local" },
    { role: "Admin",     email: "admin@demo.local" },
];

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const result = await signIn("credentials", { email, password, redirect: false });
            if (result?.error) {
                setError("Invalid email or password.");
            } else {
                await getSession();
                router.push("/dashboard");
                router.refresh();
            }
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
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
                </CardContent>
            </Card>
        </div>
    );
}
