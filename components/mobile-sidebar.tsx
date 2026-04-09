"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Home01Icon,
    Note01Icon,
    UserGroupIcon,
    Location01Icon,
    DashboardCircleIcon,
    Menu01Icon,
    Cancel01Icon,
    Money03Icon,
    File01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/lib/types";

export function MobileSidebar() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const { data: session, status } = useSession();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Prevent hydration mismatch
    if (!mounted || status === "loading" || !session) return null;

    const userRole = (session.user as { role: UserRole })?.role;
    const isApplicant = userRole === "APPLICANT";
    const isOfficer = userRole === "OFFICER";
    const isAdmin = userRole === "ADMIN";
    const isStaff = isOfficer || isAdmin;

    const navItems = [
        {
            title: "Dashboard",
            href: "/dashboard",
            icon: Home01Icon,
            active: pathname === "/dashboard",
        },
        {
            title: "Permits",
            href: "/permits",
            icon: File01Icon,
            active: pathname === "/permits",
        },
        ...(isApplicant ? [
            {
                title: "My Applications",
                href: "/applications",
                icon: Note01Icon,
                active: pathname === "/applications",
            },
            {
                title: "My Transactions",
                href: "/transactions",
                icon: Money03Icon,
                active: pathname === "/transactions",
            },
        ] : []),
        ...(isOfficer || isAdmin ? [
            {
                title: "Review Queue",
                href: "/officer/applications",
                icon: UserGroupIcon,
                active: pathname === "/officer/applications",
            },
            {
                title: "All Applications",
                href: "/applications",
                icon: Note01Icon,
                active: pathname === "/applications" && !pathname.startsWith("/applications/new"),
            },
        ] : []),
        ...(isStaff ? [
            {
                title: "Permit Map",
                href: "/map",
                icon: Location01Icon,
                active: pathname === "/map",
            },
        ] : []),
        ...(isAdmin ? [
            {
                title: "Admin Dashboard",
                href: "/admin",
                icon: DashboardCircleIcon,
                active: pathname === "/admin",
            },
        ] : []),
    ];

    return (
        <div className="md:hidden">
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(true)}
                className="h-10 w-10"
            >
                <HugeiconsIcon icon={Menu01Icon} className="h-6 w-6" />
                <span className="sr-only">Open Menu</span>
            </Button>

            {isOpen && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
                    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-background p-6 shadow-lg animate-in slide-in-from-left duration-300">
                        <div className="flex items-center justify-between mb-8">
                            <Link
                                href="/dashboard"
                                className="flex items-center space-x-3"
                                onClick={() => setIsOpen(false)}
                            >
                                <img
                                    src="https://lcc.mw/wp-content/uploads/2023/01/PNG-LCC-logo.png"
                                    alt="LCC Logo"
                                    className="h-10 w-auto"
                                />
                                <div>
                                    <span className="font-bold text-sm tracking-tight block leading-tight">Lilongwe City Council</span>
                                </div>
                            </Link>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsOpen(false)}
                            >
                                <HugeiconsIcon icon={Cancel01Icon} className="h-6 w-6" />
                                <span className="sr-only">Close Menu</span>
                            </Button>
                        </div>
                        <nav className="space-y-2">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                                        item.active ? "bg-accent text-accent-foreground" : "transparent text-muted-foreground"
                                    )}
                                    onClick={() => setIsOpen(false)}
                                >
                                    <HugeiconsIcon icon={item.icon} className="mr-2 h-4 w-4" />
                                    <span>{item.title}</span>
                                </Link>
                            ))}
                        </nav>
                    </div>
                </div>
            )}
        </div>
    );
}
