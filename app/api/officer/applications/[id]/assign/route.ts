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

        const userRole = (session.user as any).role as string | undefined;
        const isStaff = userRole === "OFFICER" || userRole === "ADMIN";
        if (!isStaff) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const application = await prisma.permitApplication.findUnique({
            where: { id },
            select: { id: true, officerId: true, status: true, permitType: true, reviewedAt: true },
        });

        if (!application) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }

        const updated = await prisma.permitApplication.update({
            where: { id },
            data: {
                officerId: session.user.id,
                reviewedAt: application.reviewedAt ?? new Date(),
            } as any,
            include: {
                applicant: { select: { id: true, name: true, email: true } },
                officer: { select: { id: true, name: true, email: true } },
            },
        });

        await prisma.timelineEvent.create({
            data: {
                applicationId: id,
                event: "Assigned to Officer",
                description: "Application was assigned to an officer for review.",
                status: updated.status,
            },
        });

        return NextResponse.json({ application: updated });
    } catch (error) {
        console.error("Assign officer error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
