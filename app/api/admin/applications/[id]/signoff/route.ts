import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { decisionEmail } from "@/lib/email-templates";

const signoffSchema = z.object({
    decision: z.enum(["APPROVE", "REJECT"]),
    notes: z.string().optional(),
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
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const userRole = (session.user as any).role as string;
        if (userRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const body = await req.json();
        const parsed = signoffSchema.parse(body);

        const application = await prisma.permitApplication.findUnique({
            where: { id },
            include: {
                applicant: { select: { id: true, name: true, email: true } },
                permitTypeRef: { select: { name: true } },
                certificate: true,
            },
        });

        if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

        if (application.status !== "PENDING_APPROVAL") {
            return NextResponse.json({ error: "Application is not pending sign-off" }, { status: 409 });
        }

        const nextStatus = parsed.decision === "APPROVE" ? "APPROVED" : "REJECTED";
        const eventLabel = parsed.decision === "APPROVE" ? "Application Approved (Admin Sign-off)" : "Application Rejected (Admin Sign-off)";

        await prisma.permitApplication.update({
            where: { id },
            data: {
                status: nextStatus,
                approvedAt: parsed.decision === "APPROVE" ? new Date() : undefined,
                officerId: application.officerId || session.user.id,
            },
        });

        await prisma.timelineEvent.create({
            data: {
                applicationId: id,
                event: eventLabel,
                description: parsed.notes || `Final decision by ${(session.user as any).name || "Admin"}.`,
                status: nextStatus,
            },
        });

        // Generate certificate on approval
        let certificateNo: string | undefined;
        if (parsed.decision === "APPROVE" && !application.certificate) {
            certificateNo = generateCertificateNo(id);
            const issueDate = new Date();
            const expiryDate = new Date(issueDate);
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            await prisma.certificate.create({
                data: {
                    applicationId: id,
                    certificateNo,
                    qrCode: JSON.stringify({ certificateNo, applicationId: id, issuedAt: issueDate.toISOString() }),
                    issueDate,
                    expiryDate,
                },
            });
            await prisma.timelineEvent.create({
                data: {
                    applicationId: id,
                    event: "Certificate Generated",
                    description: `Certificate ${certificateNo} generated.`,
                    status: "APPROVED",
                },
            });
        }

        const permitTypeName = application.permitTypeRef?.name || application.permitType;

        // Notify applicant
        await createNotification({
            userId: application.applicant.id,
            title: parsed.decision === "APPROVE" ? "Application Approved" : "Application Rejected",
            message: `Your ${permitTypeName} application has been ${parsed.decision === "APPROVE" ? "approved" : "rejected"}. ${parsed.notes ? `Notes: ${parsed.notes}` : ""}`,
            type: parsed.decision === "APPROVE" ? "SUCCESS" : "ERROR",
            link: `/applications/${id}`,
        });

        await sendEmail({
            to: application.applicant.email,
            subject: `Application ${parsed.decision === "APPROVE" ? "Approved" : "Rejected"} — ${permitTypeName}`,
            html: decisionEmail({
                applicantName: application.applicant.name || "Applicant",
                permitType: permitTypeName,
                decision: nextStatus as "APPROVED" | "REJECTED",
                notes: parsed.notes,
                applicationId: id,
                certificateNo,
            }),
        });

        return NextResponse.json({ success: true, status: nextStatus });
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
        console.error("Admin signoff error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
