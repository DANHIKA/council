"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn, Shield, Building2, FileText, Users } from "lucide-react";

const DEMO_ACCOUNTS = [
    { role: "Applicant", email: "applicant@demo.local", color: "text-sky-400" },
    { role: "Officer", email: "officer@demo.local", color: "text-amber-400" },
    { role: "Admin", email: "admin@demo.local", color: "text-rose-400" },
];

const STATS = [
    { icon: FileText, label: "Permits Issued", value: "12,400+" },
    { icon: Users, label: "Registered Users", value: "3,200+" },
    { icon: Building2, label: "Active Projects", value: "840+" },
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
                setError("Invalid email or password. Please try again.");
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

    const fillDemo = (demoEmail: string) => {
        setEmail(demoEmail);
        setPassword("Password123!");
        setError(null);
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');

                .login-root {
                    font-family: 'DM Sans', sans-serif;
                    min-height: 100svh;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    background: #0a0f1e;
                }
                @media (max-width: 900px) {
                    .login-root { grid-template-columns: 1fr; }
                    .login-panel { display: none; }
                }

                /* ── Left decorative panel ── */
                .login-panel {
                    position: relative;
                    overflow: hidden;
                    background: #0d1528;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    padding: 3rem;
                }
                .panel-grid {
                    position: absolute;
                    inset: 0;
                    background-image:
                        linear-gradient(rgba(196,160,90,0.06) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(196,160,90,0.06) 1px, transparent 1px);
                    background-size: 48px 48px;
                }
                .panel-glow {
                    position: absolute;
                    width: 520px;
                    height: 520px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(196,160,90,0.12) 0%, transparent 70%);
                    top: -120px;
                    left: -120px;
                    pointer-events: none;
                }
                .panel-glow-2 {
                    position: absolute;
                    width: 360px;
                    height: 360px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%);
                    bottom: 60px;
                    right: -80px;
                    pointer-events: none;
                }
                .seal {
                    position: relative;
                    z-index: 1;
                    width: 72px;
                    height: 72px;
                    border-radius: 50%;
                    border: 2px solid rgba(196,160,90,0.6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(196,160,90,0.08);
                    box-shadow: 0 0 0 6px rgba(196,160,90,0.06), 0 0 32px rgba(196,160,90,0.12);
                }
                .panel-headline {
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: 2.4rem;
                    font-weight: 700;
                    line-height: 1.15;
                    color: #f0ead6;
                    letter-spacing: -0.02em;
                    position: relative;
                    z-index: 1;
                }
                .panel-headline em {
                    font-style: normal;
                    color: #c4a05a;
                }
                .panel-sub {
                    font-size: 0.9rem;
                    color: rgba(240,234,214,0.45);
                    line-height: 1.7;
                    max-width: 320px;
                    margin-top: 1rem;
                    position: relative;
                    z-index: 1;
                }
                .divider-line {
                    height: 1px;
                    background: linear-gradient(90deg, rgba(196,160,90,0.5), transparent);
                    margin: 2rem 0;
                    position: relative;
                    z-index: 1;
                }
                .stat-row {
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                    position: relative;
                    z-index: 1;
                }
                .stat-item {
                    display: flex;
                    align-items: center;
                    gap: 0.875rem;
                }
                .stat-icon-wrap {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    background: rgba(196,160,90,0.1);
                    border: 1px solid rgba(196,160,90,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .stat-value {
                    font-size: 1rem;
                    font-weight: 500;
                    color: #f0ead6;
                    line-height: 1;
                }
                .stat-label {
                    font-size: 0.72rem;
                    color: rgba(240,234,214,0.4);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    margin-top: 2px;
                }
                .panel-footer {
                    font-size: 0.7rem;
                    color: rgba(240,234,214,0.2);
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                    position: relative;
                    z-index: 1;
                }

                /* ── Right form panel ── */
                .login-form-side {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 2.5rem 2rem;
                    background: #0a0f1e;
                    position: relative;
                }
                .form-card {
                    width: 100%;
                    max-width: 400px;
                }
                .form-eyebrow {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    letter-spacing: 0.12em;
                    color: #c4a05a;
                    font-weight: 500;
                    margin-bottom: 1.5rem;
                }
                .eyebrow-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #c4a05a;
                    box-shadow: 0 0 6px rgba(196,160,90,0.7);
                }
                .form-title {
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: 2rem;
                    font-weight: 600;
                    color: #f0ead6;
                    letter-spacing: -0.02em;
                    line-height: 1.2;
                    margin-bottom: 0.5rem;
                }
                .form-desc {
                    font-size: 0.85rem;
                    color: rgba(240,234,214,0.4);
                    margin-bottom: 2rem;
                    line-height: 1.6;
                }
                .field-wrap {
                    margin-bottom: 1.1rem;
                }
                .field-label {
                    display: block;
                    font-size: 0.75rem;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: rgba(240,234,214,0.55);
                    margin-bottom: 0.45rem;
                }
                .field-input {
                    width: 100%;
                    background: rgba(240,234,214,0.04) !important;
                    border: 1px solid rgba(240,234,214,0.1) !important;
                    border-radius: 8px !important;
                    color: #f0ead6 !important;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 0.9rem !important;
                    padding: 0.65rem 0.875rem !important;
                    height: auto !important;
                    transition: border-color 0.15s, box-shadow 0.15s;
                    outline: none;
                }
                .field-input::placeholder { color: rgba(240,234,214,0.2) !important; }
                .field-input:focus {
                    border-color: rgba(196,160,90,0.5) !important;
                    box-shadow: 0 0 0 3px rgba(196,160,90,0.08) !important;
                }
                .submit-btn {
                    width: 100%;
                    background: #c4a05a !important;
                    color: #0a0f1e !important;
                    font-family: 'DM Sans', sans-serif;
                    font-weight: 500 !important;
                    font-size: 0.875rem !important;
                    letter-spacing: 0.04em;
                    border-radius: 8px !important;
                    height: 44px !important;
                    margin-top: 1.5rem;
                    border: none !important;
                    cursor: pointer;
                    transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
                    box-shadow: 0 4px 16px rgba(196,160,90,0.2);
                }
                .submit-btn:hover:not(:disabled) {
                    background: #d4b06a !important;
                    box-shadow: 0 4px 24px rgba(196,160,90,0.35);
                }
                .submit-btn:active:not(:disabled) { transform: translateY(1px); }
                .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

                /* demo accounts */
                .demo-section {
                    margin-top: 2rem;
                    padding-top: 1.5rem;
                    border-top: 1px solid rgba(240,234,214,0.08);
                }
                .demo-title {
                    font-size: 0.68rem;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: rgba(240,234,214,0.3);
                    margin-bottom: 0.75rem;
                }
                .demo-pills {
                    display: flex;
                    flex-direction: column;
                    gap: 0.4rem;
                }
                .demo-pill {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.45rem 0.75rem;
                    border-radius: 6px;
                    background: rgba(240,234,214,0.03);
                    border: 1px solid rgba(240,234,214,0.07);
                    cursor: pointer;
                    transition: background 0.15s, border-color 0.15s;
                }
                .demo-pill:hover {
                    background: rgba(240,234,214,0.06);
                    border-color: rgba(196,160,90,0.25);
                }
                .demo-role {
                    font-size: 0.72rem;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.07em;
                }
                .demo-email {
                    font-size: 0.72rem;
                    color: rgba(240,234,214,0.35);
                    font-family: 'Courier New', monospace;
                }

                /* error */
                .error-alert {
                    background: rgba(239,68,68,0.08) !important;
                    border: 1px solid rgba(239,68,68,0.2) !important;
                    border-radius: 8px !important;
                    margin-bottom: 1rem;
                    color: #fca5a5 !important;
                    font-size: 0.82rem;
                }
            `}</style>

            <div className="login-root">
                {/* ── Decorative left panel ── */}
                <div className="login-panel">
                    <div className="panel-grid" />
                    <div className="panel-glow" />
                    <div className="panel-glow-2" />

                    {/* Top: seal + wordmark */}
                    <div>
                        <div className="seal">
                            <Shield size={28} color="#c4a05a" strokeWidth={1.5} />
                        </div>
                        <div style={{ marginTop: "2rem" }}>
                            <div className="panel-headline">
                                Council<br /><em>Permit</em><br />Portal
                            </div>
                            <p className="panel-sub">
                                The official digital gateway for permit applications,
                                approvals, and compliance management.
                            </p>
                        </div>
                    </div>

                    {/* Middle: stats */}
                    <div>
                        <div className="divider-line" />
                        <div className="stat-row">
                            {STATS.map(({ icon: Icon, label, value }) => (
                                <div className="stat-item" key={label}>
                                    <div className="stat-icon-wrap">
                                        <Icon size={16} color="#c4a05a" strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <div className="stat-value">{value}</div>
                                        <div className="stat-label">{label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="panel-footer">
                        &copy; {new Date().getFullYear()} Municipal Council &mdash; All rights reserved
                    </div>
                </div>

                {/* ── Form panel ── */}
                <div className="login-form-side">
                    <div className="form-card">
                        <div className="form-eyebrow">
                            <span className="eyebrow-dot" />
                            Secure Access
                        </div>
                        <h1 className="form-title">Welcome back</h1>
                        <p className="form-desc">Sign in to manage permits and applications.</p>

                        <form onSubmit={handleSubmit}>
                            {error && (
                                <Alert className="error-alert">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="field-wrap">
                                <label className="field-label" htmlFor="email">Email address</label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={loading}
                                    className="field-input"
                                />
                            </div>

                            <div className="field-wrap">
                                <label className="field-label" htmlFor="password">Password</label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                    className="field-input"
                                />
                            </div>

                            <Button type="submit" disabled={loading} className="submit-btn">
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Verifying…
                                    </>
                                ) : (
                                    <>
                                        <LogIn className="mr-2 h-4 w-4" />
                                        Sign In
                                    </>
                                )}
                            </Button>
                        </form>

                        {/* Demo accounts */}
                        <div className="demo-section">
                            <p className="demo-title">Demo accounts — click to fill</p>
                            <div className="demo-pills">
                                {DEMO_ACCOUNTS.map(({ role, email: demoEmail, color }) => (
                                    <button
                                        key={role}
                                        type="button"
                                        className="demo-pill"
                                        onClick={() => fillDemo(demoEmail)}
                                        disabled={loading}
                                    >
                                        <span className={`demo-role ${color}`}>{role}</span>
                                        <span className="demo-email">{demoEmail}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
