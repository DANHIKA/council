import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export type ServerSession = {
    user: {
        id: string;       // Prisma CUID
        email: string;
        name: string | null;
        role: string;
        supabaseId: string;
    };
};

export async function auth(): Promise<ServerSession | null> {
    try {
        const supabase = await createSupabaseServerClient();
        // getSession reads the JWT from the cookie without a network call to Supabase.
        // This is necessary when the server cannot reach supabase.co (e.g. restricted networks).
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return null;
        const user = session.user;

        // Fast path: role + prismaId stored in app_metadata (set during user creation)
        const appMeta = user.app_metadata ?? {};
        if (appMeta.prismaId && appMeta.role) {
            return {
                user: {
                    id: appMeta.prismaId,
                    email: user.email!,
                    name: user.user_metadata?.name ?? null,
                    role: appMeta.role,
                    supabaseId: user.id,
                },
            };
        }

        // Fallback: look up Prisma user by supabaseId
        const prismaUser = await prisma.user.findUnique({
            where: { supabaseId: user.id },
            select: { id: true, email: true, name: true, role: true },
        });
        if (!prismaUser) return null;

        return {
            user: {
                id: prismaUser.id,
                email: prismaUser.email,
                name: prismaUser.name,
                role: prismaUser.role as string,
                supabaseId: user.id,
            },
        };
    } catch {
        return null;
    }
}
