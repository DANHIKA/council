import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import { join } from "path";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; documentId: string }> }) {
    try {
        const { id, documentId } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const document = await prisma.document.findUnique({
            where: { id: documentId },
            include: {
                application: { select: { id: true, applicantId: true, status: true } },
            },
        });

        if (!document) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        if (document.applicationId !== id) {
            return NextResponse.json({ error: "Document does not belong to this application" }, { status: 400 });
        }

        if (document.application.applicantId !== session?.user?.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (document.application.status !== "SUBMITTED" && document.application.status !== "REQUIRES_CORRECTION") {
            return NextResponse.json({ error: "Cannot delete documents for this application status" }, { status: 400 });
        }

        if (document.status !== "PENDING") {
            return NextResponse.json({ error: "Cannot delete a document that has been reviewed" }, { status: 400 });
        }

        const filepath = join(process.cwd(), "public", document.fileUrl);
        try {
            await unlink(filepath);
        } catch (err) {
            console.warn("Failed to delete file from disk:", filepath, err);
        }

        await prisma.document.delete({
            where: { id: documentId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete document error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
