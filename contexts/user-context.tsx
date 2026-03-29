"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export type UserProfile = {
    id: string;        // Prisma CUID
    email: string;
    name: string | null;
    role: string;
    supabaseId: string;
    image?: string | null;
};

type UserContextType = {
    profile: UserProfile | null;
    status: "loading" | "authenticated" | "unauthenticated";
    refresh: () => Promise<void>;
};

const UserContext = createContext<UserContextType>({
    profile: null,
    status: "loading",
    refresh: async () => {},
});

function buildProfile(user: User): UserProfile | null {
    const appMeta = user.app_metadata ?? {};
    if (!appMeta.prismaId) return null;
    return {
        id: appMeta.prismaId,
        email: user.email!,
        name: user.user_metadata?.name ?? null,
        role: appMeta.role ?? "APPLICANT",
        supabaseId: user.id,
        image: user.user_metadata?.avatar_url ?? null,
    };
}

export function UserProvider({ children }: { children: ReactNode }) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

    const refresh = useCallback(async () => {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setProfile(null);
            setStatus("unauthenticated");
            return;
        }
        const p = buildProfile(user);
        if (p) {
            setProfile(p);
            setStatus("authenticated");
        } else {
            // app_metadata not set yet — fetch from API
            const res = await fetch("/api/user/me");
            if (res.ok) {
                const data = await res.json();
                setProfile(data.user);
                setStatus("authenticated");
            } else {
                setProfile(null);
                setStatus("unauthenticated");
            }
        }
    }, []);

    useEffect(() => {
        const supabase = createSupabaseBrowserClient();
        refresh();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "SIGNED_OUT") {
                setProfile(null);
                setStatus("unauthenticated");
            } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
                refresh();
            }
        });
        return () => subscription.unsubscribe();
    }, [refresh]);

    return (
        <UserContext.Provider value={{ profile, status, refresh }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUserContext() {
    return useContext(UserContext);
}
