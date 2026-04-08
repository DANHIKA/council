import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Update payment method
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

        const paymentMethod = await prisma.paymentMethod.findFirst({
            where: { id, adminId: session.user.id },
        });

        if (!paymentMethod) {
            return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
        }

        // If setting as default, unset other defaults
        if (body.isDefault) {
            await prisma.paymentMethod.updateMany({
                where: { adminId: session.user.id, isDefault: true, id: { not: id } },
                data: { isDefault: false },
            });
        }

        const updated = await prisma.paymentMethod.update({
            where: { id },
            data: {
                ...(body.details && { details: body.details }),
                ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
                ...(body.isActive !== undefined && { isActive: body.isActive }),
            },
        });

        return NextResponse.json({ data: updated });
    } catch (error) {
        console.error("Update payment method error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// Delete payment method
export async function DELETE(
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

        const paymentMethod = await prisma.paymentMethod.findFirst({
            where: { id, adminId: session.user.id },
            include: { _count: { select: { withdrawals: true } } },
        });

        if (!paymentMethod) {
            return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
        }

        if (paymentMethod._count.withdrawals > 0) {
            return NextResponse.json(
                { error: "Cannot delete payment method with existing withdrawals. Deactivate instead." },
                { status: 400 }
            );
        }

        await prisma.paymentMethod.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete payment method error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
