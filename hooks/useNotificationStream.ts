"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

/**
 * Connects to /api/notifications/stream (SSE) and invalidates
 * the React Query "notifications" cache whenever a new notification
 * event arrives. Falls back gracefully if SSE isn't supported.
 */
export function useNotificationStream() {
    const queryClient = useQueryClient();
    const { data: session } = useSession();

    useEffect(() => {
        if (!session?.user) return;
        if (typeof EventSource === "undefined") return;

        const es = new EventSource("/api/notifications/stream");

        es.addEventListener("notification", () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        });

        es.onerror = () => {
            // SSE will auto-reconnect; nothing extra needed
        };

        return () => {
            es.close();
        };
    }, [session?.user, queryClient]);
}
