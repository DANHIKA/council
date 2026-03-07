import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
                permitTypeRef: {
                    include: {
                        requirements: {
                            include: {
                                documents: {
                                    where: { applicationId: id },
                                    select: { id: true, status: true },
                                },
                            },
                        },
                    },
                },
                documents: { select: { id: true, requirementId: true, status: true } },
            },
        });

        if (!application) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }

        if (application.applicantId !== session?.user?.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (application.status !== "SUBMITTED") {
            return NextResponse.json({ error: "Application can only be submitted when in DRAFT/SUBMITTED state" }, { status: 400 });
        }

        const missingRequired = application.permitTypeRef?.requirements.filter(req => {
            if (!req.required) return false;
            const hasDoc = req.documents.length > 0;
            return !hasDoc;
        });

        if ((missingRequired?.length ?? 0) > 0) {
            return NextResponse.json({
                error: "Missing required documents",
                missing: missingRequired?.map(r => ({ key: r.key, label: r.label })) || [],
            }, { status: 400 });
        }

        const updated = await prisma.permitApplication.update({
            where: { id },
            data: {
                status: "UNDER_REVIEW",
            },
            include: {
                applicant: { select: { id: true, name: true, email: true } },
                permitTypeRef: { select: { id: true, name: true, code: true } },
                documents: true,
                timeline: { orderBy: { createdAt: "asc" } },
            },
        });

        await prisma.timelineEvent.create({
            data: {
                applicationId: id,
                event: "Application Under Review",
                description: `Application for ${application.permitTypeRef?.name} is now under review.`,
                status: "UNDER_REVIEW",
            },
        });

        return NextResponse.json({ application: updated });
    } catch (error) {
        console.error("Submit application error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
