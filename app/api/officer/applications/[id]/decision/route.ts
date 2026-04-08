import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { pendingSignoffEmail, decisionEmail } from "@/lib/email-templates";

const decisionSchema = z.object({
    decision: z.enum(["APPROVE", "REJECT", "REQUIRES_CORRECTION"]),
    notes: z.string().optional(),
    internal: z.boolean().optional().default(false),
});

function generateCertificateNo(applicationId: string) {
    const short = applicationId.slice(-6).toUpperCase();
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `CERT-${y}${m}${d}-${short}`;
}

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

        const body = await req.json();
        const parsed = decisionSchema.parse(body);

        const application = await prisma.permitApplication.findUnique({
            where: { id },
            include: {
                applicant: { select: { id: true, name: true, email: true } },
                permitTypeRef: { select: { id: true, name: true, code: true, applicationFee: true } },
                certificate: true,
            },
        });

        if (!application) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }

        if (application.officerId && application.officerId !== session.user.id && userRole !== "ADMIN") {
            return NextResponse.json({ error: "Application already assigned to another officer" }, { status: 409 });
        }

        // Check payment status - officers can't review unpaid applications
        const fee = Number(application.permitTypeRef?.applicationFee ?? 0);
        if (fee > 0) {
            const payments = await prisma.payment.findMany({
                where: { applicationId: id },
                select: { status: true },
            });

            const isPaid = payments.some(p => p.status === "PAID");
            const isWaived = payments.some(p => p.status === "WAIVED");

            if (!isPaid && !isWaived) {
                return NextResponse.json(
                    { error: "Application payment is pending. Cannot proceed with review." },
                    { status: 400 }
                );
            }
        }

        // Assign officer if not already assigned
        if (!application.officerId) {
            await prisma.permitApplication.update({
                where: { id },
                data: { officerId: session.user.id, reviewedAt: new Date() },
            });
        }

        let nextStatus: "PENDING_APPROVAL" | "REJECTED" | "REQUIRES_CORRECTION";
        let event: string;
        if (parsed.decision === "APPROVE") {
            nextStatus = "PENDING_APPROVAL";
            event = "Approval Recommended";
        } else if (parsed.decision === "REJECT") {
            nextStatus = "REJECTED";
            event = "Application Rejected";
        } else {
            nextStatus = "REQUIRES_CORRECTION";
            event = "Correction Required";
        }

        const updated = await prisma.permitApplication.update({
            where: { id },
            data: {
                status: nextStatus,
            },
            include: {
                applicant: { select: { id: true, name: true, email: true } },
                officer: { select: { id: true, name: true, email: true } },
                documents: { include: { requirement: { select: { key: true, label: true } } } },
                comments: {
                    include: { author: { select: { id: true, name: true, role: true } } },
                    orderBy: { createdAt: "asc" },
                },
                certificate: true,
                timeline: { orderBy: { createdAt: "asc" } },
                permitTypeRef: { select: { id: true, name: true, code: true } },
            },
        });

        if (parsed.notes && parsed.notes.trim().length > 0) {
            await prisma.comment.create({
                data: {
                    applicationId: id,
                    authorId: session.user.id,
                    content: parsed.notes,
                    isInternal: parsed.internal,
                },
            });
        }

        await prisma.timelineEvent.create({
            data: {
                applicationId: id,
                event,
                description: parsed.notes ? parsed.notes : undefined,
                status: nextStatus,
            },
        });

        // On recommendation, notify all admins for sign-off
        if (parsed.decision === "APPROVE") {
            const admins = await prisma.user.findMany({
                where: { role: "ADMIN" },
                select: { id: true, name: true, email: true },
            });

            const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

            await Promise.all(
                admins.map(async (admin) => {
                    const [approveToken, rejectToken] = await Promise.all([
                        prisma.reviewToken.create({
                            data: { applicationId: id, officerId: admin.id, action: "FINAL_APPROVE", expiresAt },
                        }),
                        prisma.reviewToken.create({
                            data: { applicationId: id, officerId: admin.id, action: "FINAL_REJECT", expiresAt },
                        }),
                    ]);

                    await createNotification({
                        userId: admin.id,
                        title: "Application Pending Sign-off",
                        message: `Officer ${(session.user as any).name || "Officer"} has recommended approval for a ${application.permitTypeRef?.name || application.permitType} application.`,
                        type: "INFO",
                        link: `/officer/review/${id}`,
                    });

                    await sendEmail({
                        to: admin.email,
                        subject: `Sign-off Required: ${application.permitTypeRef?.name || application.permitType}`,
                        html: pendingSignoffEmail({
                            adminName: admin.name || "Admin",
                            officerName: (session.user as any).name || "Officer",
                            applicantName: application.applicant.name || "Applicant",
                            applicantEmail: application.applicant.email,
                            permitType: application.permitTypeRef?.name || application.permitType,
                            description: application.description,
                            location: application.location,
                            applicationId: id,
                            approveToken: approveToken.token,
                            rejectToken: rejectToken.token,
                        }),
                    });
                })
            );
        } else {
            // For reject/corrections, notify the applicant
            await createNotification({
                userId: application.applicant.id,
                title: event,
                message: `Your application for ${application.permitTypeRef?.name || application.permitType} has been updated. ${parsed.notes ? `Notes: ${parsed.notes}` : ""}`,
                type: nextStatus === "REJECTED" ? "ERROR" : "WARNING",
                link: `/applications/${id}`,
            });

            await sendEmail({
                to: application.applicant.email,
                subject: `Application ${nextStatus === "REJECTED" ? "Rejected" : "Requires Corrections"} — ${application.permitTypeRef?.name || application.permitType}`,
                html: decisionEmail({
                    applicantName: application.applicant.name || "Applicant",
                    permitType: application.permitTypeRef?.name || application.permitType,
                    decision: nextStatus as "REJECTED" | "REQUIRES_CORRECTION",
                    notes: parsed.notes,
                    applicationId: id,
                }),
            });
        }

        const finalApp = await prisma.permitApplication.findUnique({
            where: { id },
            include: {
                applicant: { select: { id: true, name: true, email: true, phone: true, organization: true } },
                officer: { select: { id: true, name: true, email: true } },
                documents: { include: { requirement: { select: { key: true, label: true } } } },
                comments: {
                    include: { author: { select: { id: true, name: true, role: true } } },
                    orderBy: { createdAt: "asc" },
                },
                certificate: true,
                timeline: { orderBy: { createdAt: "asc" } },
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
            },
        });

        return NextResponse.json({ application: finalApp ?? updated });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        console.error("Officer decision error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
