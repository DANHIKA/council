import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

const createCommentSchema = z.object({
    content: z.string().min(1),
    isInternal: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const parsed = createCommentSchema.parse(body);

        const application = await prisma.permitApplication.findUnique({
            where: { id },
            select: { id: true, applicantId: true, officerId: true, permitType: true },
        });

        if (!application) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }

        const userRole = (session.user as any).role as string | undefined;
        const isOwner = application.applicantId === session.user.id;
        const isStaff = userRole === "OFFICER" || userRole === "ADMIN";

        if (!isOwner && !isStaff) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (parsed.isInternal && !isStaff) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const comment = await prisma.comment.create({
            data: {
                applicationId: id,
                authorId: session.user.id,
                content: parsed.content,
                isInternal: parsed.isInternal,
            },
            include: {
                author: { select: { id: true, name: true, role: true } },
            },
        });

        // Trigger Notification
        if (isOwner && application.officerId) {
            // Notify officer
            await createNotification({
                userId: application.officerId,
                title: "New Comment",
                message: `${session.user.name} commented on application for ${application.permitType}.`,
                type: "INFO",
                link: `/officer/review/${id}`,
            });
        } else if (isStaff && !parsed.isInternal) {
            // Notify applicant
            await createNotification({
                userId: application.applicantId,
                title: "New Comment from Council",
                message: `An officer has commented on your application for ${application.permitType}.`,
                type: "INFO",
                link: `/applications/${id}`,
            });
        }

        await prisma.timelineEvent.create({
            data: {
                applicationId: id,
                event: "Comment Added",
                description: parsed.isInternal ? "An internal comment was added." : "A comment was added.",
                status: "SUBMITTED",
            },
        });

        return NextResponse.json({ comment }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        console.error("Create comment error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
