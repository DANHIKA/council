import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

const documentReviewSchema = z.object({
    status: z.enum(["APPROVED", "REJECTED"]),
    reviewNotes: z.string().optional(),
});

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; documentId: string }> }
) {
    try {
        const { id, documentId } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userRole = (session.user as any).role as string;
        const isStaff = userRole === "OFFICER" || userRole === "ADMIN";
        if (!isStaff) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const parsed = documentReviewSchema.parse(body);

        const document = await prisma.document.findUnique({
            where: { id: documentId },
            include: {
                application: {
                    include: {
                        applicant: { select: { id: true, name: true, email: true } },
                        officer: { select: { id: true, name: true, email: true } },
                        permitTypeRef: { select: { name: true } },
                    },
                },
            },
        });

        if (!document) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        if (document.applicationId !== id) {
            return NextResponse.json({ error: "Document does not belong to this application" }, { status: 400 });
        }

        // Already reviewed
        if (document.status !== "PENDING") {
            return NextResponse.json({ error: "Document already reviewed" }, { status: 409 });
        }

        // Update document
        const updated = await prisma.document.update({
            where: { id: documentId },
            data: {
                status: parsed.status,
                reviewNotes: parsed.reviewNotes || null,
            },
        });

        // Notify applicant about document review
        await createNotification({
            userId: document.application.applicant.id,
            title: `Document ${parsed.status === "APPROVED" ? "Approved" : "Rejected"}`,
            message: `Your document "${document.name}" has been ${parsed.status.toLowerCase()}.${parsed.reviewNotes ? ` Notes: ${parsed.reviewNotes}` : ""}`,
            type: parsed.status === "APPROVED" ? "SUCCESS" : "ERROR",
            link: `/applications/${id}`,
        });

        return NextResponse.json({ document: updated });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        console.error("Document review error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
