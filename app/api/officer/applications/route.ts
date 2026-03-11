import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        console.log("GET /api/officer/applications - session:", {
            userId: session?.user?.id,
            email: session?.user?.email,
            role: (session?.user as any)?.role
        });

        if (!session?.user?.id) {
            console.log("GET /api/officer/applications - Unauthorized");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userRole = (session.user as any).role as string | undefined;
        const isStaff = userRole === "OFFICER" || userRole === "ADMIN";
        if (!isStaff) {
            console.log(`GET /api/officer/applications - Forbidden: user role ${userRole} is not staff`);
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");
        const q = searchParams.get("q") || "";
        const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
        const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 100);
        const skip = (page - 1) * limit;

        console.log("GET /api/officer/applications - query params:", { status, q, page, limit });

        const where: any = {};
        if (status) where.status = status;
        if (q) {
            where.OR = [
                { permitType: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { location: { contains: q, mode: "insensitive" } },
                { applicant: { email: { contains: q, mode: "insensitive" } } },
                { applicant: { name: { contains: q, mode: "insensitive" } } },
            ];
        }

        const [total, applications] = await Promise.all([
            prisma.permitApplication.count({ where }),
            prisma.permitApplication.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                include: {
                    applicant: { select: { id: true, name: true, email: true } },
                    officer: { select: { id: true, name: true, email: true } },
                    permitTypeRef: { select: { id: true, name: true, code: true } },
                },
            }),
        ]);

        console.log(`GET /api/officer/applications - found ${applications.length} applications (total: ${total})`);

        return NextResponse.json({
            data: applications,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Officer applications list error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
