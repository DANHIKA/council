import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Department } from "@prisma/client";
import { logAudit } from "@/lib/audit";

const permitTypeSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    applicationFee: z.coerce.number().min(0).default(0),
    permitFee: z.coerce.number().min(0).default(0),
    validityMonths: z.coerce.number().int().min(1).max(120).default(12),
    currency: z.string().default("MWK"),
    department: z.nativeEnum(Department).default(Department.GENERAL),
    requirements: z.array(z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        description: z.string().optional(),
        required: z.boolean().default(true),
        sortOrder: z.number().default(0),
        acceptMime: z.string().optional(),
        acceptExt: z.string().optional(),
    })).default([]),
});

function slugToCode(name: string): string {
    return name
        .trim()
        .toUpperCase()
        .replace(/&/g, "AND")
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

// List all permit types (admin)
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const userRole = (session.user as any).role as string;
        if (userRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const permitTypes = await prisma.permitType.findMany({
            include: { requirements: { orderBy: { sortOrder: "asc" } } },
            orderBy: { name: "asc" },
        });

        return NextResponse.json({ permitTypes });
    } catch (error) {
        console.error("List permit types error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// Create a new permit type
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const userRole = (session.user as any).role as string;
        if (userRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const body = await req.json();
        const parsed = permitTypeSchema.parse(body);

        const code = slugToCode(parsed.name);

        // Check for duplicate code
        const existing = await prisma.permitType.findUnique({ where: { code } });
        if (existing) {
            return NextResponse.json({ error: `A permit type "${parsed.name}" already exists` }, { status: 409 });
        }

        const permitType = await prisma.permitType.create({
            data: {
                code,
                name: parsed.name,
                description: parsed.description,
                applicationFee: parsed.applicationFee,
                permitFee: parsed.permitFee,
                validityMonths: parsed.validityMonths,
                currency: parsed.currency,
                department: parsed.department,
            },
        });

        // Create requirements
        if (parsed.requirements.length > 0) {
            await prisma.permitRequirement.createMany({
                data: parsed.requirements.map(r => ({
                    ...r,
                    permitTypeId: permitType.id,
                })),
            });
        }

        const withReqs = await prisma.permitType.findUnique({
            where: { id: permitType.id },
            include: { requirements: { orderBy: { sortOrder: "asc" } } },
        });

        // Audit log
        await logAudit({
            userId: session.user.id,
            action: "CREATE",
            entityType: "PERMIT_TYPE",
            entityId: permitType.id,
            description: `Created permit type "${permitType.name}"`,
            metadata: { name: permitType.name, applicationFee: parsed.applicationFee, permitFee: parsed.permitFee },
        });

        return NextResponse.json({ permitType: withReqs }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        console.error("Create permit type error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
