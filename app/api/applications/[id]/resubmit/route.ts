import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const application = await prisma.permitApplication.findUnique({
            where: { id },
            include: {
                permitTypeRef: { select: { name: true } },
                officer: { select: { id: true } },
            },
        });

        if (!application) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }

        if (application.applicantId !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (application.status !== "REQUIRES_CORRECTION") {
            return NextResponse.json(
                { error: "Application must be in REQUIRES_CORRECTION status to resubmit" },
                { status: 400 }
            );
        }

        const updated = await prisma.permitApplication.update({
            where: { id },
            data: { status: "UNDER_REVIEW" },
        });

        await prisma.timelineEvent.create({
            data: {
                applicationId: id,
                event: "Corrections Submitted",
                description: "Applicant has submitted corrections. Application is back under review.",
                status: "UNDER_REVIEW",
            },
        });

        if (application.officerId) {
            await createNotification({
                userId: application.officerId,
                title: "Corrections Submitted",
                message: `Applicant has submitted corrections for ${application.permitTypeRef?.name || application.permitType}.`,
                type: "INFO",
                link: `/officer/review/${id}`,
            });
        }

        return NextResponse.json({ application: updated });
    } catch (error) {
        console.error("Resubmit error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
