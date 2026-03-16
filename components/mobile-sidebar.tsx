"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Home01Icon,
    Note01Icon,
    AddCircleIcon,
    UserGroupIcon,
    Location01Icon,
    UserIcon,
    DashboardCircleIcon,
    File02Icon,
    Menu01Icon,
    Cancel01Icon,
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

    const navItems = [
        {
            title: "Dashboard",
            href: "/dashboard",
            icon: Home01Icon,
            active: pathname === "/dashboard",
        },
        ...(isApplicant ? [
            {
                title: "My Applications",
                href: "/applications",
                icon: Note01Icon,
                active: pathname === "/applications",
            },
            {
                title: "New Application",
                href: "/applications/new",
                icon: AddCircleIcon,
                active: pathname === "/applications/new",
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
        {
            title: "Permit Map",
            href: "/map",
            icon: Location01Icon,
            active: pathname === "/map",
        },
        {
            title: "Profile",
            href: "/profile",
            icon: UserIcon,
            active: pathname === "/profile",
        },
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
                                className="flex items-center space-x-2"
                                onClick={() => setIsOpen(false)}
                            >
                                <HugeiconsIcon icon={File02Icon} className="h-6 w-6 text-primary" />
                                <span className="font-bold text-xl tracking-tight">Council Portal</span>
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
