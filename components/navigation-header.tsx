"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
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
    Tick01Icon,
    Notification01Icon,
    ArrowDown01Icon,
    Logout01Icon,
    Note01Icon,
    UserIcon,
    UserGroupIcon
} from "@hugeicons/core-free-icons";
import { LayoutDashboard, FileText, PlusCircle, Map, Users, Search } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/lib/queries";
import type { UserRole } from "@/lib/types";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileSidebar } from "@/components/mobile-sidebar";

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
    const { data: notificationsData } = useNotifications();
    const markReadMutation = useMarkNotificationRead();
    const markAllReadMutation = useMarkAllNotificationsRead();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const notifications = notificationsData?.notifications || [];
    const unreadCount = notificationsData?.unreadCount || 0;

    const userRole = (session?.user as { role: UserRole })?.role ?? "";

    const { open: cmdOpen, setOpen: setCmdOpen, navigate: cmdNavigate, isStaff } =
        useCommandPalette(userRole, router);

    const markAsRead = async (id: string) => {
        try {
            await markReadMutation.mutateAsync(id);
        } catch (err) {
            console.error("Failed to mark notification as read:", err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await markAllReadMutation.mutateAsync();
        } catch (err) {
            console.error("Failed to mark all as read:", err);
        }
    };

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
                {/* Logo/Brand */}
                <div className="flex items-center space-x-4">
                    <MobileSidebar />
                    <Link href="/dashboard" className="flex items-center space-x-2 md:hidden">
                        <HugeiconsIcon icon={Note01Icon} className="h-6 w-6 text-primary" />
                    </Link>
                    <div className="hidden md:flex items-center space-x-2">
                        {/* Empty space or breadcrumbs can go here */}
                    </div>
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
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={
                                    <Button variant="ghost" size="icon" className="relative">
                                        <HugeiconsIcon icon={Notification01Icon} className="h-5 w-5" />
                                        {unreadCount > 0 && (
                                            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white">
                                                {unreadCount > 9 ? "9+" : unreadCount}
                                            </span>
                                        )}
                                    </Button>
                                }
                            />
                            <DropdownMenuContent align="end" className="w-80 p-0">
                                <div className="p-4 border-b flex items-center justify-between">
                                    <h3 className="font-semibold">Notifications</h3>
                                    {unreadCount > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-auto p-0 text-xs text-primary"
                                            onClick={markAllAsRead}
                                        >
                                            Mark all as read
                                        </Button>
                                    )}
                                </div>
                                <div className="max-h-[400px] overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground text-sm">
                                            No notifications yet
                                        </div>
                                    ) : (
                                        notifications.map((n) => (
                                            <DropdownMenuItem
                                                key={n.id}
                                                className={`p-4 flex flex-col items-start gap-1 cursor-pointer border-b last:border-0 ${!n.read ? "bg-muted/50" : ""}`}
                                                render={
                                                    <Link
                                                        href={n.link || "#"}
                                                        onClick={() => !n.read && markAsRead(n.id)}
                                                    />
                                                }
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <span className="font-medium text-sm">{n.title}</span>
                                                    {!n.read && <HugeiconsIcon icon={Tick01Icon} className="h-2 w-2 fill-primary text-primary" />}
                                                </div>
                                                <p className="text-xs text-muted-foreground line-clamp-2">
                                                    {n.message}
                                                </p>
                                                <span className="text-[10px] text-muted-foreground mt-1">
                                                    {formatDateTime(n.createdAt)}
                                                </span>
                                            </DropdownMenuItem>
                                        ))
                                    )}
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={
                                    <Button variant="ghost" className="flex items-center space-x-2 h-auto p-2">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                                        </Avatar>
                                        <div className="hidden sm:flex flex-col items-start text-left">
                                            <span className="text-sm font-medium">{userName}</span>
                                            <Badge variant="secondary" className={`text-[10px] px-1 h-4 ${getRoleBadgeColor(userRole)}`}>
                                                {getRoleLabel(userRole)}
                                            </Badge>
                                        </div>
                                        <HugeiconsIcon icon={ArrowDown01Icon} className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                }
                            />
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium">{userName}</p>
                                        <p className="text-xs text-muted-foreground">{userEmail}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                    render={
                                        <Link href="/profile" className="flex items-center" />
                                    }
                                >
                                    <HugeiconsIcon icon={UserIcon} className="mr-2 h-4 w-4" />
                                    Profile
                                </DropdownMenuItem>

                                {userRole === "ADMIN" && (
                                    <DropdownMenuItem
                                        render={
                                            <Link href="/admin" className="flex items-center" />
                                        }
                                    >
                                        <HugeiconsIcon icon={UserGroupIcon} className="mr-2 h-4 w-4" />
                                        Admin Dashboard
                                    </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                    onClick={handleLogout}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <HugeiconsIcon icon={Logout01Icon} className="mr-2 h-4 w-4" />
                                    Sign Out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
        </header>

        {/* Global Command Palette */}
        <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen} title="Quick Navigation">
            <CommandInput placeholder="Search pages and actions..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Navigation">
                    <CommandItem onSelect={() => cmdNavigate("/dashboard")}>
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                        <CommandShortcut>⌘D</CommandShortcut>
                    </CommandItem>
                    {!isStaff && (
                        <CommandItem onSelect={() => cmdNavigate("/applications/new")}>
                            <PlusCircle className="h-4 w-4" />
                            New Application
                        </CommandItem>
                    )}
                    <CommandItem onSelect={() => cmdNavigate("/applications")}>
                        <FileText className="h-4 w-4" />
                        {isStaff ? "All Applications" : "My Applications"}
                    </CommandItem>
                    <CommandItem onSelect={() => cmdNavigate("/map")}>
                        <Map className="h-4 w-4" />
                        Permit Map
                    </CommandItem>
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
                    <CommandItem onSelect={() => cmdNavigate("/profile")}>
                        <HugeiconsIcon icon={UserIcon} className="h-4 w-4" />
                        Profile
                    </CommandItem>
                    <CommandItem onSelect={() => signOut({ callbackUrl: "/auth/login" })} className="text-destructive data-selected:text-destructive">
                        <HugeiconsIcon icon={Logout01Icon} className="h-4 w-4" />
                        Sign Out
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
        </>
    );
}
