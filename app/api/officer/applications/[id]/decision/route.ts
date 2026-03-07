import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

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
                permitTypeRef: { select: { id: true, name: true, code: true } },
                certificate: true,
            },
        });

        if (!application) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }

        if (application.officerId && application.officerId !== session.user.id && userRole !== "ADMIN") {
            return NextResponse.json({ error: "Application already assigned to another officer" }, { status: 409 });
        }

        // Assign officer if not already assigned
        if (!application.officerId) {
            await prisma.permitApplication.update({
                where: { id },
                data: { officerId: session.user.id, reviewedAt: new Date() },
            });
        }

        let nextStatus: "APPROVED" | "REJECTED" | "REQUIRES_CORRECTION";
        let event: string;
        if (parsed.decision === "APPROVE") {
            nextStatus = "APPROVED";
            event = "Application Approved";
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
                approvedAt: parsed.decision === "APPROVE" ? new Date() : null,
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

        // Trigger Notification
        await createNotification({
            userId: application.applicant.id,
            title: event,
            message: `Your application for ${application.permitTypeRef?.name || application.permitType} has been updated to: ${nextStatus}. ${parsed.notes ? `Notes: ${parsed.notes}` : ""}`,
            type: nextStatus === "APPROVED" ? "SUCCESS" : nextStatus === "REJECTED" ? "ERROR" : "WARNING",
            link: `/applications/${id}`,
        });

        // Option A: auto-generate certificate on approval
        if (parsed.decision === "APPROVE") {
            const existing = await prisma.certificate.findUnique({
                where: { applicationId: id },
            });

            if (!existing) {
                const issueDate = new Date();
                const expiryDate = new Date(issueDate);
                expiryDate.setFullYear(expiryDate.getFullYear() + 1);

                const certificateNo = generateCertificateNo(id);

                await prisma.certificate.create({
                    data: {
                        applicationId: id,
                        certificateNo,
                        qrCode: JSON.stringify({
                            certificateNo,
                            applicationId: id,
                            issuedAt: issueDate.toISOString(),
                        }),
                        issueDate,
                        expiryDate,
                    },
                });

                await prisma.timelineEvent.create({
                    data: {
                        applicationId: id,
                        event: "Certificate Generated",
                        description: `Certificate ${certificateNo} generated automatically on approval.`,
                        status: "APPROVED",
                    },
                });
            }
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
