"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "@/hooks/useSession";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Command,
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Notification01Icon,
    ArrowDown01Icon,
    Logout01Icon,
    UserIcon,
    UserGroupIcon
} from "@hugeicons/core-free-icons";
import { LayoutDashboard, FileText, PlusCircle, Map, Users, Search, CreditCard } from "lucide-react";
import { useNotifications } from "@/lib/queries";
import { usePermissions } from "@/hooks/usePermissions";
import { useNotificationStream } from "@/hooks/useNotificationStream";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { ProfileSheet } from "@/components/profile-sheet";
import { NotificationsSheet } from "@/components/notifications-sheet";

type Crumb = { label: string; href?: string };

function buildBreadcrumbs(pathname: string): Crumb[] {
    const seg = pathname.split("/").filter(Boolean);
    if (!seg.length) return [];

    if (seg[0] === "dashboard") return [{ label: "Dashboard" }];
    if (seg[0] === "permits") return [{ label: "Permits" }];
    if (seg[0] === "chat") return [{ label: "AI Chat" }];
    if (seg[0] === "profile") return [{ label: "Profile" }];
    if (seg[0] === "map") return [{ label: "Map" }];

    if (seg[0] === "applications") {
        if (!seg[1]) return [{ label: "Applications" }];
        return [{ label: "Applications", href: "/applications" }, { label: "Details" }];
    }

    if (seg[0] === "transactions") return [{ label: "Transactions" }];

    if (seg[0] === "officer") {
        if (seg[1] === "applications") return [{ label: "Officer" }, { label: "Review Queue" }];
        if (seg[1] === "review") return [{ label: "Officer", href: "/officer/applications" }, { label: "Review Application" }];
    }

    if (seg[0] === "admin") {
        const base: Crumb = { label: "Admin", href: "/admin" };
        const labels: Record<string, string> = {
            audit: "Audit Log",
            permits: "Permit Types",
            transactions: "Transactions",
            withdrawals: "Withdrawals",
        };
        if (!seg[1]) return [{ label: "Admin" }];
        return [base, { label: labels[seg[1]] ?? seg[1] }];
    }

    return [];
}

function useCommandPalette(userRole: string, router: ReturnType<typeof useRouter>) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setOpen((o) => !o);
            }
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, []);

    const navigate = (path: string) => {
        setOpen(false);
        router.push(path);
    };

    const isStaff = userRole === "OFFICER" || userRole === "ADMIN";

    return { open, setOpen, navigate, isStaff };
}

export function NavigationHeader() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const crumbs = buildBreadcrumbs(pathname);
    const { data: notificationsData } = useNotifications();
    useNotificationStream();
    const [mounted, setMounted] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const unreadCount = notificationsData?.unreadCount || 0;

    const { role: userRole, isStaff, isAdmin } = usePermissions();
    const safeRole = userRole ?? "";

    const { open: cmdOpen, setOpen: setCmdOpen, navigate: cmdNavigate } =
        useCommandPalette(safeRole, router);

    // Prevent hydration mismatch
    if (!mounted || status === "loading") {
        return (
            <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="animate-pulse bg-muted h-8 w-32 rounded"></div>
                    <div className="animate-pulse bg-muted h-8 w-24 rounded"></div>
                </div>
            </header>
        );
    }

    if (!session) return null;
    const userName = session.user?.name || "User";
    const userEmail = session.user?.email || "";
    const initials = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case "ADMIN": return "bg-red-100 text-red-800";
            case "OFFICER": return "bg-blue-100 text-blue-800";
            case "APPLICANT": return "bg-green-100 text-green-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case "ADMIN": return "Admin";
            case "OFFICER": return "Officer";
            case "APPLICANT": return "Applicant";
            default: return role;
        }
    };

    const handleLogout = async () => {
        await signOut({ callbackUrl: "/auth/login" });
    };

    return (
        <>
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
            <div className="flex h-16 items-center justify-between px-4 md:px-6">
                <div className="flex items-center gap-3">
                    <MobileSidebar />
                    {crumbs.length > 0 && (
                        <Breadcrumb>
                            <BreadcrumbList>
                                {crumbs.map((crumb, i) => {
                                    const isLast = i === crumbs.length - 1;
                                    return (
                                        <span key={i} className="inline-flex items-center gap-1.5">
                                            {i > 0 && <BreadcrumbSeparator />}
                                            <BreadcrumbItem>
                                                {isLast || !crumb.href ? (
                                                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                                                ) : (
                                                    <BreadcrumbLink render={<Link href={crumb.href} />}>
                                                        {crumb.label}
                                                    </BreadcrumbLink>
                                                )}
                                            </BreadcrumbItem>
                                        </span>
                                    );
                                })}
                            </BreadcrumbList>
                        </Breadcrumb>
                    )}
                </div>

                {/* User Menu */}
                <div className="flex items-center space-x-2">
                    {/* ⌘K quick-nav trigger */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="hidden sm:flex h-8 gap-2 text-xs text-muted-foreground border-muted-foreground/20 px-3"
                        onClick={() => setCmdOpen(true)}
                    >
                        <Search className="h-3.5 w-3.5" />
                        <span>Search</span>
                        <CommandShortcut>⌘K</CommandShortcut>
                    </Button>
                    <ThemeToggle />
                    
                    {/* Notifications */}
                        <Button variant="ghost" size="icon" className="relative" onClick={() => setNotificationsOpen(true)}>
                            <HugeiconsIcon icon={Notification01Icon} className="h-5 w-5" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white">
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={
                                    <Button variant="ghost" className="flex items-center space-x-2 h-auto p-2">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={session.user?.image || ""} alt={userName} />
                                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                                        </Avatar>
                                        <div className="hidden sm:flex flex-col items-start text-left">
                                            <span className="text-sm font-medium">{userName}</span>
                                            <Badge variant="secondary" className={`text-[10px] px-1 h-4 ${getRoleBadgeColor(safeRole)}`}>
                                                {getRoleLabel(safeRole)}
                                            </Badge>
                                        </div>
                                        <HugeiconsIcon icon={ArrowDown01Icon} className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                }
                            />
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium">{userName}</p>
                                            <p className="text-xs text-muted-foreground">{userEmail}</p>
                                        </div>
                                    </DropdownMenuLabel>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />

                                <DropdownMenuGroup>
                                    <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                                        <HugeiconsIcon icon={UserIcon} className="mr-2 h-4 w-4" />
                                        Profile
                                    </DropdownMenuItem>

                                    {isAdmin && (
                                        <DropdownMenuItem
                                            render={
                                                <Link href="/admin" className="flex items-center" />
                                            }
                                        >
                                            <HugeiconsIcon icon={UserGroupIcon} className="mr-2 h-4 w-4" />
                                            Admin Dashboard
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuGroup>

                                <DropdownMenuSeparator />

                                <DropdownMenuGroup>
                                    <DropdownMenuItem
                                        onClick={handleLogout}
                                        className="text-destructive focus:text-destructive"
                                    >
                                        <HugeiconsIcon icon={Logout01Icon} className="mr-2 h-4 w-4" />
                                        Sign Out
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
        </header>

        {/* Global Command Palette */}
        <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen} title="Quick Navigation">
            <Command>
                <CommandInput placeholder="Search pages and actions..." />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup heading="Navigation">
                        <CommandItem onSelect={() => cmdNavigate("/dashboard")}>
                            <LayoutDashboard className="h-4 w-4" />
                            Dashboard
                            <CommandShortcut>⌘D</CommandShortcut>
                        </CommandItem>
                        <CommandItem onSelect={() => cmdNavigate("/permits")}>
                            <FileText className="h-4 w-4" />
                            Permits
                        </CommandItem>
                        {!isStaff && (
                            <>
                                <CommandItem onSelect={() => cmdNavigate("/applications?new=1")}>
                                    <PlusCircle className="h-4 w-4" />
                                    New Application
                                </CommandItem>
                                <CommandItem onSelect={() => cmdNavigate("/transactions")}>
                                    <CreditCard className="h-4 w-4" />
                                    My Transactions
                                </CommandItem>
                            </>
                        )}
                        <CommandItem onSelect={() => cmdNavigate("/applications")}>
                            <FileText className="h-4 w-4" />
                            {isStaff ? "All Applications" : "My Applications"}
                        </CommandItem>
                        {isStaff && (
                            <CommandItem onSelect={() => cmdNavigate("/map")}>
                                <Map className="h-4 w-4" />
                                Permit Map
                            </CommandItem>
                        )}
                    </CommandGroup>
                    {isStaff && (
                        <>
                            <CommandSeparator />
                            <CommandGroup heading="Officer">
                                <CommandItem onSelect={() => cmdNavigate("/officer/applications")}>
                                    <FileText className="h-4 w-4" />
                                    Review Queue
                                </CommandItem>
                            </CommandGroup>
                        </>
                    )}
                    {userRole === "ADMIN" && (
                        <>
                            <CommandSeparator />
                            <CommandGroup heading="Admin">
                                <CommandItem onSelect={() => cmdNavigate("/admin")}>
                                    <Users className="h-4 w-4" />
                                    Admin Dashboard
                                </CommandItem>
                            </CommandGroup>
                        </>
                    )}
                    <CommandSeparator />
                    <CommandGroup heading="Account">
                        <CommandItem onSelect={() => { setCmdOpen(false); setProfileOpen(true); }}>
                            <HugeiconsIcon icon={UserIcon} className="h-4 w-4" />
                            Profile
                        </CommandItem>
                        <CommandItem onSelect={() => signOut({ callbackUrl: "/auth/login" })} className="text-destructive data-selected:text-destructive">
                            <HugeiconsIcon icon={Logout01Icon} className="h-4 w-4" />
                            Sign Out
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </Command>
        </CommandDialog>

        <NotificationsSheet open={notificationsOpen} onOpenChange={setNotificationsOpen} />
        <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
        </>
    );
}
