import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userRole = (session.user as any).role as string | undefined;
        if (userRole !== "ADMIN" && userRole !== "OFFICER") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
        const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10));
        const status = searchParams.get("status") ?? undefined;
        const q = searchParams.get("q") ?? undefined;

        const where: any = {
            ...(status && { status }),
            ...(q && {
                OR: [
                    { txRef: { contains: q, mode: "insensitive" } },
                    { application: { applicant: { name: { contains: q, mode: "insensitive" } } } },
                    { application: { applicant: { email: { contains: q, mode: "insensitive" } } } },
                    { application: { permitType: { contains: q, mode: "insensitive" } } },
                ],
            }),
        };

        const [payments, total, summary] = await Promise.all([
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
                            applicant: { select: { id: true, name: true, email: true } },
                        },
                    },
                },
            }),
            prisma.payment.count({ where: status || q ? where : {} }),
            prisma.payment.groupBy({
                by: ["status"],
                _sum: { amount: true },
                _count: true,
            }),
        ]);

        const totalCollected = summary.find(s => s.status === "PAID")?._sum?.amount ?? 0;
        const totalPending = summary.find(s => s.status === "PENDING")?._sum?.amount ?? 0;
        const totalFailed = summary.find(s => s.status === "FAILED")?._sum?.amount ?? 0;
        const countPaid = summary.find(s => s.status === "PAID")?._count ?? 0;
        const countPending = summary.find(s => s.status === "PENDING")?._count ?? 0;

        return NextResponse.json({
            data: payments,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
            summary: {
                totalCollected: Number(totalCollected),
                totalPending: Number(totalPending),
                totalFailed: Number(totalFailed),
                countPaid,
                countPending,
                countTotal: summary.reduce((acc, s) => acc + s._count, 0),
            },
        });
    } catch (error) {
        console.error("Admin transactions error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
