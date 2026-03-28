"use client";

import { useUserContext } from "@/contexts/user-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SessionData = {
    user: {
        id: string;
        email: string;
        name: string | null;
        role: string;
        image?: string | null;
    };
};

export function useSession() {
    const { profile, status, refresh } = useUserContext();

    const data: SessionData | null = profile
        ? {
              user: {
                  id: profile.id,
                  email: profile.email,
                  name: profile.name,
                  role: profile.role,
                  image: profile.image,
              },
          }
        : null;

    // Accept optional args for API compatibility with next-auth's updateSession,
    // but always just refresh from Supabase since it's the source of truth.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update = async (_data?: any) => {
        await refresh();
    };

    return {
        data,
        status,
        update,
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function signOut(_options?: any) {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
        window.location.href = "/auth/login";
    }
}
