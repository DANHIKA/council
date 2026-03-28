import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    // supabaseId is provided by the browser after supabase.auth.signUp() succeeds
    supabaseId: z.string().uuid("Invalid Supabase user ID"),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, email, supabaseId } = registerSchema.parse(body);

        const existing = await prisma.user.findUnique({ where: { email } });

        if (existing) {
            if (existing.supabaseId) {
                // Already fully registered
                return NextResponse.json({ error: "Email already registered" }, { status: 409 });
            }
            // Pre-seeded demo account — claim it by linking the Supabase ID
            await prisma.user.update({
                where: { email },
                data: { supabaseId, name },
            });
            return NextResponse.json({ message: "Account linked successfully" }, { status: 200 });
        }

        // Brand-new user — always starts as APPLICANT
        await prisma.user.create({
            data: {
                name,
                email,
                role: "APPLICANT",
                supabaseId,
            },
        });

        return NextResponse.json({ message: "Account created successfully" }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
        }
        console.error("Register error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
