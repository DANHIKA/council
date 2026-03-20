"use client";

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick01Icon } from "@hugeicons/core-free-icons";
import { formatDateTime } from "@/lib/utils";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/lib/queries";
import Link from "next/link";

interface NotificationsSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function NotificationsSheet({ open, onOpenChange }: NotificationsSheetProps) {
    const { data: notificationsData } = useNotifications();
    const markReadMutation = useMarkNotificationRead();
    const markAllReadMutation = useMarkAllNotificationsRead();

    const notifications = notificationsData?.notifications || [];
    const unreadCount = notificationsData?.unreadCount || 0;

    const markAsRead = (id: string) => {
        markReadMutation.mutate(id);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-sm flex flex-col p-0">
                <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                    <div className="flex items-center justify-between pr-8">
                        <SheetTitle>Notifications</SheetTitle>
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 text-xs text-primary"
                                onClick={() => markAllReadMutation.mutate()}
                            >
                                Mark all as read
                            </Button>
                        )}
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground py-20">
                            <p className="text-sm">No notifications yet</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map(n => (
                                <Link
                                    key={n.id}
                                    href={n.link || "#"}
                                    onClick={() => {
                                        if (!n.read) markAsRead(n.id);
                                        onOpenChange(false);
                                    }}
                                    className={`flex flex-col gap-1 px-6 py-4 hover:bg-muted/50 transition-colors ${!n.read ? "bg-muted/30" : ""}`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium text-sm">{n.title}</span>
                                        {!n.read && (
                                            <HugeiconsIcon icon={Tick01Icon} className="h-2 w-2 fill-primary text-primary shrink-0" />
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                                    <span className="text-[10px] text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
