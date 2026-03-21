import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createNotification } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { newApplicationEmail } from "@/lib/email-templates";

const createApplicationSchema = z.object({
    permitTypeId: z.string().cuid(),
    description: z.string().min(1, "Description is required"),
    location: z.string().min(1, "Location is required"),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
});

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const validated = createApplicationSchema.parse(body);

        const permitType = await prisma.permitType.findUnique({
            where: { id: validated.permitTypeId },
            include: { requirements: { orderBy: { sortOrder: "asc" } } },
        });

        if (!permitType) {
            return NextResponse.json({ error: "Invalid permit type" }, { status: 400 });
        }

        const application = await prisma.permitApplication.create({
            data: {
                permitType: permitType.name,
                permitTypeId: permitType.id,
                description: validated.description,
                location: validated.location,
                latitude: validated.latitude,
                longitude: validated.longitude,
                applicantId: session.user.id,
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
                applicationId: application.id,
                event: "Application Submitted",
                description: `Application for ${permitType.name} was submitted.`,
                status: "SUBMITTED",
            },
        });

        // Notify officers/admins by email + in-app
        const officers = await prisma.user.findMany({
            where: { role: { in: ["OFFICER", "ADMIN"] } },
            select: { id: true, name: true, email: true },
        });

        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

        await Promise.all(
            officers.map(async (officer) => {
                // Create 3 tokens (one per action)
                const [recommendToken, correctionsToken, rejectToken] = await Promise.all([
                    prisma.reviewToken.create({
                        data: { applicationId: application.id, officerId: officer.id, action: "RECOMMEND_APPROVAL", expiresAt },
                    }),
                    prisma.reviewToken.create({
                        data: {
                            applicationId: application.id,
                            officerId: officer.id,
                            action: "REQUIRES_CORRECTION",
                            expiresAt,
                        },
                    }),
                    prisma.reviewToken.create({
                        data: { applicationId: application.id, officerId: officer.id, action: "REJECT", expiresAt },
                    }),
                ]);

                // In-app notification
                await createNotification({
                    userId: officer.id,
                    title: "New Application Submitted",
                    message: `A new ${permitType.name} application from ${application.applicant.name} is awaiting review.`,
                    type: "INFO",
                    link: `/officer/review/${application.id}`,
                });

                // Email
                await sendEmail({
                    to: officer.email,
                    subject: `New Application for Review: ${permitType.name}`,
                    html: newApplicationEmail({
                        officerName: officer.name || "Officer",
                        applicantName: application.applicant.name || "Applicant",
                        applicantEmail: application.applicant.email,
                        permitType: permitType.name,
                        description: application.description,
                        location: application.location,
                        applicationId: application.id,
                        recommendToken: recommendToken.token,
                        correctionsToken: correctionsToken.token,
                        rejectToken: rejectToken.token,
                    }),
                });
            })
        );

        return NextResponse.json({ application }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        console.error("Create application error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        console.log("GET /api/applications - session:", {
            userId: session?.user?.id,
            email: session?.user?.email,
            role: (session?.user as any)?.role
        });

        if (!session?.user?.id) {
            console.log("GET /api/applications - Unauthorized");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") ?? "1", 10);
        const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
        const status = searchParams.get("status") ?? undefined;

        console.log("GET /api/applications - query params:", { page, limit, status });

        const where = {
            applicantId: session.user.id,
            ...(status && { status: status as any }),
        };

        const [applications, total] = await Promise.all([
            prisma.permitApplication.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    applicant: { select: { id: true, name: true, email: true } },
                    officer: { select: { id: true, name: true, email: true } },
                    permitTypeRef: { select: { id: true, name: true, code: true } },
                    documents: {
                        include: { requirement: { select: { key: true, label: true } } },
                    },
                    certificate: true,
                },
            }),
            prisma.permitApplication.count({ where }),
        ]);

        console.log(`GET /api/applications - found ${applications.length} applications (total: ${total})`);

        return NextResponse.json({
            data: applications,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("List applications error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
