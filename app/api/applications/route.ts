import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createApplicationSchema = z.object({
    permitTypeId: z.string().cuid(),
    description: z.string().min(1, "Description is required"),
    location: z.string().min(1, "Location is required"),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
});

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const validated = createApplicationSchema.parse(body);

        const permitType = await prisma.permitType.findUnique({
            where: { id: validated.permitTypeId },
            include: { requirements: { orderBy: { sortOrder: "asc" } } },
        });

        if (!permitType) {
            return NextResponse.json({ error: "Invalid permit type" }, { status: 400 });
        }

        const application = await prisma.permitApplication.create({
            data: {
                permitType: permitType.name,
                permitTypeId: permitType.id,
                description: validated.description,
                location: validated.location,
                latitude: validated.latitude,
                longitude: validated.longitude,
                applicantId: session.user.id,
            },
            include: {
                applicant: { select: { id: true, name: true, email: true } },
                permitTypeRef: { select: { id: true, name: true, code: true } },
                documents: true,
                timeline: { orderBy: { createdAt: "asc" } },
            },
        });

        return NextResponse.json({ application }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
        const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20), 100);
        const status = searchParams.get("status") ?? undefined;

        // Validate status against enum
        const validStatuses = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "REQUIRES_CORRECTION", "PENDING_APPROVAL"];
        if (status && !validStatuses.includes(status)) {
            return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
        }

        const where = {
            applicantId: session.user.id,
            ...(status && { status: status as any }),
        };

        const [applications, total] = await Promise.all([
            prisma.permitApplication.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    applicant: { select: { id: true, name: true, email: true } },
                    officer: { select: { id: true, name: true, email: true } },
                    permitTypeRef: { select: { id: true, name: true, code: true } },
                    documents: {
                        include: { requirement: { select: { key: true, label: true } } },
                    },
                    certificate: true,
                },
            }),
            prisma.permitApplication.count({ where }),
        ]);

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
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
