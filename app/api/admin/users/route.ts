import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateRoleSchema = z.object({
    userId: z.string(),
    role: z.enum(["APPLICANT", "OFFICER", "ADMIN"]),
});

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        });

        if (currentUser?.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                _count: {
                    select: { applications: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ users });
    } catch (error) {
        console.error("List users error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        });

        if (currentUser?.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const validated = updateRoleSchema.parse(body);

        // Prevent changing own role
        if (validated.userId === session.user.id) {
            return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
        }

        const updatedUser = await prisma.user.update({
            where: { id: validated.userId },
            data: { role: validated.role },
        });

        return NextResponse.json({ user: updatedUser });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        console.error("Update role error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
