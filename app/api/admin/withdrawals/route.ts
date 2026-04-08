import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Get admin's withdrawals
export async function GET(req: NextRequest) {
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

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");

        const where: any = { adminId: session.user.id };
        if (status && status !== "ALL") {
            where.status = status;
        }

        const withdrawals = await prisma.withdrawal.findMany({
            where,
            include: {
                paymentMethod: {
                    select: { id: true, type: true, isDefault: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // Calculate summary
        const summary = await prisma.withdrawal.aggregate({
            where: { adminId: session.user.id },
            _sum: { amount: true },
            _count: {
                where: { status: "PENDING" },
            },
        });

        const completed = await prisma.withdrawal.count({
            where: { adminId: session.user.id, status: "COMPLETED" },
        });

        return NextResponse.json({
            data: withdrawals,
            summary: {
                totalWithdrawn: summary._sum.amount?.toNumber() || 0,
                pendingWithdrawals: summary._count || 0,
                completedWithdrawals: completed,
            },
        });
    } catch (error) {
        console.error("Get withdrawals error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// Create withdrawal request
export async function POST(req: NextRequest) {
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

        const body = await req.json();
        const { amount, paymentMethodId, notes } = body;

        if (!amount || amount <= 0) {
            return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
        }

        if (!paymentMethodId) {
            return NextResponse.json({ error: "Payment method is required" }, { status: 400 });
        }

        // Verify payment method belongs to this admin
        const paymentMethod = await prisma.paymentMethod.findFirst({
            where: { id: paymentMethodId, adminId: session.user.id, isActive: true },
        });

        if (!paymentMethod) {
            return NextResponse.json({ error: "Payment method not found or inactive" }, { status: 404 });
        }

        const withdrawal = await prisma.withdrawal.create({
            data: {
                adminId: session.user.id,
                paymentMethodId,
                amount,
                currency: "MWK",
                notes: notes || null,
                status: "PENDING",
            },
            include: {
                paymentMethod: true,
            },
        });

        return NextResponse.json({ data: withdrawal }, { status: 201 });
    } catch (error) {
        console.error("Create withdrawal error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
