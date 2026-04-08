import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Update withdrawal status
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        });

        if (user?.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();
        const { status, reference, notes } = body;

        const withdrawal = await prisma.withdrawal.findFirst({
            where: { id, adminId: session.user.id },
        });

        if (!withdrawal) {
            return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
        }

        // Only allow certain status transitions
        const validTransitions: Record<string, string[]> = {
            PENDING: ["PROCESSING", "CANCELLED"],
            PROCESSING: ["COMPLETED", "FAILED"],
            COMPLETED: [],
            FAILED: [],
            CANCELLED: [],
        };

        if (status && !validTransitions[withdrawal.status].includes(status)) {
            return NextResponse.json(
                { error: `Invalid status transition from ${withdrawal.status} to ${status}` },
                { status: 400 }
            );
        }

        const updated = await prisma.withdrawal.update({
            where: { id },
            data: {
                ...(status && { status }),
                ...(reference && { reference }),
                ...(notes && { notes }),
                ...(status === "COMPLETED" && { processedAt: new Date() }),
            },
            include: {
                paymentMethod: true,
            },
        });

        return NextResponse.json({ data: updated });
    } catch (error) {
        console.error("Update withdrawal error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
