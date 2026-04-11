import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const userRole = (session.user as any).role as string;
        if (userRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const { searchParams } = req.nextUrl;
        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
        const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50), 100);
        const entityType = searchParams.get("entityType") ?? undefined;
        const action = searchParams.get("action") ?? undefined;

        const where = {
            ...(entityType && { entityType }),
            ...(action && { action }),
        };

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    user: { select: { id: true, name: true, email: true, role: true } },
                },
            }),
            prisma.auditLog.count({ where }),
        ]);

        return NextResponse.json({
            data: logs,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error("Audit log list error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
