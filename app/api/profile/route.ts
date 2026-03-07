import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateProfileSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    phone: z.string().optional(),
    organization: z.string().optional(),
});

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                phone: true,
                organization: true,
                image: true,
                createdAt: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({ user });
    } catch (error) {
        console.error("Get profile error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const validated = updateProfileSchema.parse(body);

        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                name: validated.name,
                phone: validated.phone,
                organization: validated.organization,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                phone: true,
                organization: true,
            },
        });

        return NextResponse.json({ user: updatedUser });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        console.error("Update profile error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
