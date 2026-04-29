import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase/admin";

const registerSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log("[api/register] body received:", { name: body.name, email: body.email });

        const { name, email, password } = registerSchema.parse(body);
        console.log("[api/register] validated:", { name, email });

        const existing = await prisma.user.findUnique({ where: { email } });
        console.log("[api/register] existing user:", existing ? { id: existing.id, hasSbId: !!existing.supabaseId } : null);

        if (existing?.supabaseId) {
            console.log("[api/register] 409 — already registered");
            return NextResponse.json({ error: "Email already registered" }, { status: 409 });
        }

        // Create Supabase user server-side (admin API has no signup rate limit)
        const { data: sbData, error: sbError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name },
        });
        if (sbError || !sbData.user) {
            console.error("[api/register] supabase createUser error:", sbError);
            return NextResponse.json({ error: sbError?.message || "Failed to create auth account" }, { status: 500 });
        }
        const supabaseId = sbData.user.id;
        console.log("[api/register] supabase user created:", supabaseId.slice(0, 8) + "…");

        if (existing) {
            // Pre-seeded demo account — claim it by linking the Supabase ID
            const updated = await prisma.user.update({
                where: { email },
                data: { supabaseId, name },
            });
            console.log("[api/register] linked demo account, prismaId:", updated.id);
            await supabaseAdmin.auth.admin.updateUserById(supabaseId, {
                app_metadata: { prismaId: updated.id, role: updated.role },
            });
            return NextResponse.json({ message: "Account linked successfully" }, { status: 200 });
        }

        const newUser = await prisma.user.create({
            data: { name, email, role: "APPLICANT", supabaseId },
        });
        console.log("[api/register] created new user, prismaId:", newUser.id);

        await supabaseAdmin.auth.admin.updateUserById(supabaseId, {
            app_metadata: { prismaId: newUser.id, role: newUser.role },
        });
        console.log("[api/register] supabase metadata updated → 201");

        return NextResponse.json({ message: "Account created successfully" }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error("[api/register] validation error:", error.issues);
            return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
        }
        console.error("[api/register] unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
