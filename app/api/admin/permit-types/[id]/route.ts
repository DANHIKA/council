import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Department } from "@prisma/client";
import { logAudit } from "@/lib/audit";

const requirementSchema = z.object({
    id: z.string().optional(),
    key: z.string().min(1),
    label: z.string().min(1),
    description: z.string().optional(),
    required: z.boolean().default(true),
    sortOrder: z.number().default(0),
    acceptMime: z.string().optional(),
    acceptExt: z.string().optional(),
});

const permitTypeUpdateSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    applicationFee: z.coerce.number().min(0).optional(),
    permitFee: z.coerce.number().min(0).optional(),
    validityMonths: z.coerce.number().int().min(1).max(120).optional(),
    currency: z.string().optional(),
    department: z.nativeEnum(Department).optional(),
    requirements: z.array(requirementSchema).optional(),
});

function slugToCode(name: string): string {
    return name
        .trim()
        .toUpperCase()
        .replace(/&/g, "AND")
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

// Update a permit type with its requirements
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const userRole = (session.user as any).role as string;
        if (userRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const { id } = await params;
        const body = await req.json();
        const parsed = permitTypeUpdateSchema.parse(body);

        const permitType = await prisma.permitType.findUnique({
            where: { id },
            include: { requirements: true },
        });
        if (!permitType) {
            return NextResponse.json({ error: "Permit type not found" }, { status: 404 });
        }

        // Update base fields
        const updated = await prisma.permitType.update({
            where: { id },
            data: {
                ...(parsed.name && { name: parsed.name }),
                ...(parsed.description !== undefined && { description: parsed.description }),
                ...(parsed.applicationFee !== undefined && { applicationFee: parsed.applicationFee }),
                ...(parsed.permitFee !== undefined && { permitFee: parsed.permitFee }),
                ...(parsed.validityMonths !== undefined && { validityMonths: parsed.validityMonths }),
                ...(parsed.currency && { currency: parsed.currency }),
                ...(parsed.department && { department: parsed.department }),
            },
        });

        // If name changed, regenerate code
        if (parsed.name && parsed.name !== permitType.name) {
            const newCode = slugToCode(parsed.name);
            await prisma.permitType.update({ where: { id }, data: { code: newCode } });
        }

        // Update requirements if provided
        if (parsed.requirements) {
            const existingKeys = new Set(permitType.requirements.map(r => r.key));
            const newKeys = new Set(parsed.requirements.map(r => r.key));

            for (const req of parsed.requirements) {
                if (existingKeys.has(req.key)) {
                    // Update existing
                    await prisma.permitRequirement.updateMany({
                        where: { permitTypeId: id, key: req.key },
                        data: {
                            label: req.label,
                            description: req.description,
                            required: req.required,
                            sortOrder: req.sortOrder,
                            acceptMime: req.acceptMime,
                            acceptExt: req.acceptExt,
                        },
                    });
                } else {
                    // Create new
                    await prisma.permitRequirement.create({
                        data: {
                            permitTypeId: id,
                            key: req.key,
                            label: req.label,
                            description: req.description,
                            required: req.required,
                            sortOrder: req.sortOrder,
                            acceptMime: req.acceptMime,
                            acceptExt: req.acceptExt,
                        },
                    });
                }
            }

            // Remove deleted requirements
            for (const key of existingKeys) {
                if (!newKeys.has(key)) {
                    await prisma.permitRequirement.deleteMany({
                        where: { permitTypeId: id, key },
                    });
                }
            }
        }

        const withReqs = await prisma.permitType.findUnique({
            where: { id },
            include: { requirements: { orderBy: { sortOrder: "asc" } } },
        });

        // Audit log
        await logAudit({
            userId: session.user.id,
            action: "UPDATE",
            entityType: "PERMIT_TYPE",
            entityId: id,
            description: `Updated permit type "${withReqs?.name || id}"`,
            metadata: { updatedFields: Object.keys(parsed) },
        });

        return NextResponse.json({ permitType: withReqs });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        console.error("Update permit type error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// Delete a permit type
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const userRole = (session.user as any).role as string;
        if (userRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const { id } = await params;

        const appCount = await prisma.permitApplication.count({ where: { permitTypeId: id } });
        if (appCount > 0) {
            return NextResponse.json({ error: "Cannot delete: this permit type has applications" }, { status: 409 });
        }

        await prisma.permitType.delete({ where: { id } });

        // Audit log
        await logAudit({
            userId: session.user.id,
            action: "DELETE",
            entityType: "PERMIT_TYPE",
            entityId: id,
            description: `Deleted permit type`,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete permit type error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
