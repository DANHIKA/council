"use client";

import { useSession, signOut } from "next-auth/react";
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
import { Badge } from "@/components/ui/badge";
import { 
    Circle, 
    Bell, 
    ChevronDown, 
    LogOut, 
    FileText,
    Settings,
    User,
    Users
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/lib/queries";
import type { UserRole } from "@/lib/types";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileSidebar } from "@/components/mobile-sidebar";

export function NavigationHeader() {
    const { data: session, status } = useSession();
    const { data: notificationsData } = useNotifications();
    const markReadMutation = useMarkNotificationRead();
    const markAllReadMutation = useMarkAllNotificationsRead();

    const notifications = notificationsData?.notifications || [];
    const unreadCount = notificationsData?.unreadCount || 0;

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

    if (status === "loading") {
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

    const userRole = (session.user as { role: UserRole })?.role;
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
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
            <div className="flex h-16 items-center justify-between px-4 md:px-6">
                {/* Logo/Brand */}
                <div className="flex items-center space-x-4">
                    <MobileSidebar />
                    <Link href="/dashboard" className="flex items-center space-x-2 md:hidden">
                        <FileText className="h-6 w-6 text-primary" />
                    </Link>
                    <div className="hidden md:flex items-center space-x-2">
                        {/* Empty space or breadcrumbs can go here */}
                    </div>
                </div>

                {/* User Menu */}
                <div className="flex items-center space-x-2">
                    <ThemeToggle />
                    
                    {/* Notifications */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="relative">
                                    <Bell className="h-5 w-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white">
                                            {unreadCount > 9 ? "9+" : unreadCount}
                                        </span>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
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
                                                asChild
                                            >
                                                <Link
                                                    href={n.link || "#"}
                                                    onClick={() => !n.read && markAsRead(n.id)}
                                                >
                                                    <div className="flex items-center justify-between w-full">
                                                        <span className="font-medium text-sm">{n.title}</span>
                                                        {!n.read && <Circle className="h-2 w-2 fill-primary text-primary" />}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                                        {n.message}
                                                    </p>
                                                    <span className="text-[10px] text-muted-foreground mt-1">
                                                        {formatDateTime(n.createdAt)}
                                                    </span>
                                                </Link>
                                            </DropdownMenuItem>
                                        ))
                                    )}
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
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
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium">{userName}</p>
                                        <p className="text-xs text-muted-foreground">{userEmail}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />

                                <DropdownMenuItem asChild>
                                            <Link href="/profile" className="flex items-center">
                                                <User className="mr-2 h-4 w-4" />
                                                Profile
                                            </Link>
                                        </DropdownMenuItem>

                                {userRole === "ADMIN" && (
                                    <DropdownMenuItem asChild>
                                            <Link href="/admin" className="flex items-center">
                                                <Users className="mr-2 h-4 w-4" />
                                                Admin Dashboard
                                            </Link>
                                        </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                    onClick={handleLogout}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Sign Out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
        </header>
    );
}
