import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
        const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));
        const status = searchParams.get("status") ?? undefined;

        const where = {
            application: { applicantId: session.user.id },
            ...(status && { status: status as any }),
        };

        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    application: {
                        select: {
                            id: true,
                            permitType: true,
                            status: true,
                        },
                    },
                },
            }),
            prisma.payment.count({ where }),
        ]);

        // Summary totals
        const [summary] = await Promise.all([
            prisma.payment.groupBy({
                by: ["status"],
                where: { application: { applicantId: session.user.id } },
                _sum: { amount: true },
                _count: true,
            }),
        ]);

        const totalPaid = summary.find(s => s.status === "PAID")?._sum?.amount ?? 0;
        const totalPending = summary.find(s => s.status === "PENDING")?._sum?.amount ?? 0;
        const totalFailed = summary.find(s => s.status === "FAILED")?._sum?.amount ?? 0;

        return NextResponse.json({
            data: payments,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
            summary: {
                totalPaid: Number(totalPaid),
                totalPending: Number(totalPending),
                totalFailed: Number(totalFailed),
                count: total,
            },
        });
    } catch (error) {
        console.error("Transactions error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
