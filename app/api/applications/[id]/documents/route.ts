import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { z } from "zod";

const uploadSchema = z.object({
    requirementId: z.string().cuid().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File;
        const requirementId = formData.get("requirementId") as string;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const validated = uploadSchema.parse({ requirementId });

        const application = await prisma.permitApplication.findUnique({
            where: { id },
            select: { id: true, applicantId: true, status: true },
        });

        if (!application) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }

        if (application.applicantId !== session?.user?.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (application.status !== "SUBMITTED" && application.status !== "REQUIRES_CORRECTION") {
            return NextResponse.json({ error: "Cannot upload documents for this application status" }, { status: 400 });
        }

        if (validated.requirementId) {
            const requirement = await prisma.permitRequirement.findUnique({
                where: { id: validated.requirementId },
                select: { id: true, acceptMime: true, acceptExt: true },
            });

            if (!requirement) {
                return NextResponse.json({ error: "Invalid requirement" }, { status: 400 });
            }

            if (requirement.acceptMime && !requirement.acceptMime.split(",").some(m => file.type.trim() === m.trim())) {
                return NextResponse.json({ error: "File type not allowed for this requirement" }, { status: 400 });
            }

            const ext = "." + file.name.split(".").pop()?.toLowerCase();
            if (requirement.acceptExt && !requirement.acceptExt.split(",").some(e => e.trim().toLowerCase() === ext)) {
                return NextResponse.json({ error: "File extension not allowed for this requirement" }, { status: 400 });
            }
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadsDir = join(process.cwd(), "public", "uploads", "applications", id);
        await mkdir(uploadsDir, { recursive: true });

        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const filename = `${uniqueSuffix}-${file.name}`;
        const filepath = join(uploadsDir, filename);

        await writeFile(filepath, buffer);

        const publicUrl = `/uploads/applications/${id}/${filename}`;

        const document = await prisma.document.create({
            data: {
                name: file.name,
                fileUrl: publicUrl,
                fileType: file.type,
                fileSize: buffer.length,
                requirementId: validated.requirementId,
                applicationId: id,
            },
            include: {
                requirement: { select: { key: true, label: true } },
            },
        });

        return NextResponse.json({ document }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        console.error("Upload document error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const application = await prisma.permitApplication.findUnique({
            where: { id },
            select: { id: true, applicantId: true },
        });

        if (!application) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }

        const userRole = (session?.user as any)?.role;
        const isOwner = application.applicantId === session?.user?.id;
        const isOfficerOrAdmin = userRole === "OFFICER" || userRole === "ADMIN";

        if (!isOwner && !isOfficerOrAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const documents = await prisma.document.findMany({
            where: { applicationId: id },
            include: {
                requirement: { select: { key: true, label: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ documents });
    } catch (error) {
        console.error("List documents error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
