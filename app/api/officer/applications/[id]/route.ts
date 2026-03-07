import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userRole = (session.user as any).role as string | undefined;
        const isStaff = userRole === "OFFICER" || userRole === "ADMIN";
        if (!isStaff) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const application = await prisma.permitApplication.findUnique({
            where: { id },
            include: {
                applicant: { select: { id: true, name: true, email: true, phone: true, organization: true } },
                officer: { select: { id: true, name: true, email: true } },
                permitTypeRef: {
                    include: {
                        requirements: {
                            orderBy: { sortOrder: "asc" },
                            include: {
                                documents: {
                                    where: { applicationId: id },
                                    select: {
                                        id: true,
                                        name: true,
                                        fileUrl: true,
                                        fileType: true,
                                        fileSize: true,
                                        status: true,
                                        reviewNotes: true,
                                        createdAt: true,
                                    },
                                },
                            },
                        },
                    },
                },
                documents: { include: { requirement: { select: { key: true, label: true } } } },
                comments: {
                    include: { author: { select: { id: true, name: true, role: true } } },
                    orderBy: { createdAt: "asc" },
                },
                certificate: true,
                timeline: { orderBy: { createdAt: "asc" } },
            },
        });

        if (!application) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }

        return NextResponse.json({ application });
    } catch (error) {
        console.error("Officer get application error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
