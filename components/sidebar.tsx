"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
    Home,
    ClipboardList,
    PlusCircle,
    Users,
    Map,
    User,
    LayoutDashboard,
    Settings,
    FileText,
} from "lucide-react";
import type { UserRole } from "@/lib/types";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();
    const { data: session } = useSession();

    if (!session) return null;

    const userRole = (session.user as { role: UserRole })?.role;
    const isApplicant = userRole === "APPLICANT";
    const isOfficer = userRole === "OFFICER";
    const isAdmin = userRole === "ADMIN";

    const navItems = [
        {
            title: "Dashboard",
            href: "/dashboard",
            icon: Home,
            active: pathname === "/dashboard",
        },
        ...(isApplicant ? [
            {
                title: "My Applications",
                href: "/applications",
                icon: ClipboardList,
                active: pathname === "/applications",
            },
            {
                title: "New Application",
                href: "/applications/new",
                icon: PlusCircle,
                active: pathname === "/applications/new",
            },
        ] : []),
        ...(isOfficer || isAdmin ? [
            {
                title: "Review Queue",
                href: "/officer/applications",
                icon: Users,
                active: pathname === "/officer/applications",
            },
            {
                title: "All Applications",
                href: "/applications",
                icon: ClipboardList,
                active: pathname === "/applications" && !pathname.startsWith("/applications/new"),
            },
        ] : []),
        {
            title: "Permit Map",
            href: "/map",
            icon: Map,
            active: pathname === "/map",
        },
        {
            title: "Profile",
            href: "/profile",
            icon: User,
            active: pathname === "/profile",
        },
        ...(isAdmin ? [
            {
                title: "Admin Dashboard",
                href: "/admin",
                icon: LayoutDashboard,
                active: pathname === "/admin",
            },
        ] : []),
    ];

    return (
        <div className={cn("pb-12 border-r bg-background w-64 hidden md:flex flex-col", className)}>
            <div className="flex h-16 items-center border-b px-6">
                <Link href="/dashboard" className="flex items-center space-x-2">
                    <FileText className="h-6 w-6 text-primary" />
                    <span className="font-bold text-xl tracking-tight">Council Portal</span>
                </Link>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
                <div className="px-3 py-2">
                    <div className="space-y-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                                    item.active ? "bg-accent text-accent-foreground" : "transparent text-muted-foreground"
                                )}
                            >
                                <item.icon className="mr-2 h-4 w-4" />
                                <span>{item.title}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
