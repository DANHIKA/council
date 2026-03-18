"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "@hugeicons/core-free-icons";
import { usePermissions } from "@/hooks/usePermissions";

const ICON_MAP = {
    Home01Icon,
    Note01Icon,
    AddCircleIcon,
    UserGroupIcon,
    Location01Icon,
    UserIcon,
    DashboardCircleIcon,
    File02Icon,
} as const;

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();
    const { navItems, isLoading, isAuthenticated } = usePermissions();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || isLoading || !isAuthenticated) return null;

    return (
        <div className={cn("pb-12 border-r bg-background w-64 hidden md:flex flex-col", className)}>
            <div className="flex h-16 items-center border-b px-6">
                <Link href="/dashboard" className="flex items-center space-x-2">
                    <HugeiconsIcon icon={File02Icon} className="h-6 w-6 text-primary" />
                    <span className="font-bold text-xl tracking-tight">Council Portal</span>
                </Link>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
                <div className="px-3 py-2">
                    <div className="space-y-1">
                        {navItems.map((item) => {
                            const icon = ICON_MAP[item.icon as keyof typeof ICON_MAP];
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={`${item.title}-${item.href}`}
                                    href={item.href}
                                    className={cn(
                                        "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                                        isActive
                                            ? "bg-accent text-accent-foreground"
                                            : "transparent text-muted-foreground"
                                    )}
                                >
                                    {icon && <HugeiconsIcon icon={icon} className="mr-2 h-4 w-4" />}
                                    <span>{item.title}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
