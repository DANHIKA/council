import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { decisionEmail, pendingSignoffEmail } from "@/lib/email-templates";
import type { ApplicationStatus } from "@prisma/client";

function generateCertificateNo(applicationId: string) {
    const short = applicationId.slice(-6).toUpperCase();
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `CERT-${y}${m}${d}-${short}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const { token } = await params;

    try {
        const reviewToken = await prisma.reviewToken.findUnique({
            where: { token },
            include: {
                application: {
                    include: {
                        applicant: { select: { id: true, name: true, email: true } },
                        permitTypeRef: { select: { name: true } },
                    },
                },
                officer: { select: { id: true, name: true } },
            },
        });

        if (!reviewToken) {
            return NextResponse.redirect(`${appUrl}/email-action?result=invalid`);
        }

        if (reviewToken.used) {
            return NextResponse.redirect(`${appUrl}/email-action?result=used`);
        }

        if (new Date() > reviewToken.expiresAt) {
            return NextResponse.redirect(`${appUrl}/email-action?result=expired`);
        }

        const { application, officer } = reviewToken;
        const action = reviewToken.action as string;

        // Check application is still in a reviewable state
        if (["APPROVED", "REJECTED"].includes(application.status)) {
            return NextResponse.redirect(`${appUrl}/email-action?result=already_decided`);
        }

        let nextStatus: ApplicationStatus = "REJECTED" as ApplicationStatus;
        let eventLabel: string = "";
        let notifyApplicant = true;
        let notifyAdmins = false;
        let isFinalApproval = false;

        switch (action) {
            case "RECOMMEND_APPROVAL":
                nextStatus = "PENDING_APPROVAL" as ApplicationStatus;
                eventLabel = "Approval Recommended";
                notifyApplicant = false;
                notifyAdmins = true;
                break;
            case "FINAL_APPROVE":
                nextStatus = "APPROVED" as ApplicationStatus;
                eventLabel = "Application Approved";
                isFinalApproval = true;
                break;
            case "FINAL_REJECT":
                nextStatus = "REJECTED" as ApplicationStatus;
                eventLabel = "Application Rejected (Admin)";
                break;
            case "REJECT":
                nextStatus = "REJECTED" as ApplicationStatus;
                eventLabel = "Application Rejected";
                break;
            case "REQUIRES_CORRECTION":
                nextStatus = "REQUIRES_CORRECTION" as ApplicationStatus;
                eventLabel = "Correction Required";
                break;
            default:
                return NextResponse.redirect(`${appUrl}/email-action?result=invalid`);
        }

        // Execute decision
        await prisma.permitApplication.update({
            where: { id: application.id },
            data: {
                status: nextStatus,
                officerId: officer.id,
                reviewedAt: new Date(),
                approvedAt: isFinalApproval ? new Date() : undefined,
            },
        });

        await prisma.timelineEvent.create({
            data: {
                applicationId: application.id,
                event: eventLabel,
                description: `Decision made via email quick-action by ${officer.name}.`,
                status: nextStatus,
            },
        });

        // Certificate on final approval
        let certificateNo: string | undefined;
        if (isFinalApproval) {
            const existing = await prisma.certificate.findUnique({ where: { applicationId: application.id } });
            if (!existing) {
                certificateNo = generateCertificateNo(application.id);
                const issueDate = new Date();
                const expiryDate = new Date(issueDate);
                expiryDate.setFullYear(expiryDate.getFullYear() + 1);
                await prisma.certificate.create({
                    data: {
                        applicationId: application.id,
                        certificateNo,
                        qrCode: JSON.stringify({ certificateNo, applicationId: application.id, issuedAt: issueDate.toISOString() }),
                        issueDate,
                        expiryDate,
                    },
                });
                await prisma.timelineEvent.create({
                    data: {
                        applicationId: application.id,
                        event: "Certificate Generated",
                        description: `Certificate ${certificateNo} generated.`,
                        status: "APPROVED",
                    },
                });
            }
        }

        // Mark sibling tokens used
        await prisma.reviewToken.updateMany({
            where: { applicationId: application.id, officerId: officer.id },
            data: { used: true },
        });

        const permitTypeName = application.permitTypeRef?.name || application.permitType;

        if (notifyAdmins) {
            // Notify admins for sign-off (RECOMMEND_APPROVAL case)
            const admins = await prisma.user.findMany({
                where: { role: "ADMIN" },
                select: { id: true, name: true, email: true },
            });
            const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
            await Promise.all(
                admins.map(async (admin) => {
                    const [approveToken, rejectToken] = await Promise.all([
                        prisma.reviewToken.create({ data: { applicationId: application.id, officerId: admin.id, action: "FINAL_APPROVE", expiresAt } }),
                        prisma.reviewToken.create({ data: { applicationId: application.id, officerId: admin.id, action: "FINAL_REJECT", expiresAt } }),
                    ]);
                    await createNotification({
                        userId: admin.id,
                        title: "Application Pending Sign-off",
                        message: `${officer.name} has recommended approval for a ${permitTypeName} application.`,
                        type: "INFO",
                        link: `/officer/review/${application.id}`,
                    });
                    await sendEmail({
                        to: admin.email,
                        subject: `Sign-off Required: ${permitTypeName}`,
                        html: pendingSignoffEmail({
                            adminName: admin.name || "Admin",
                            officerName: officer.name || "Officer",
                            applicantName: application.applicant.name || "Applicant",
                            applicantEmail: application.applicant.email,
                            permitType: permitTypeName,
                            description: application.description,
                            location: application.location,
                            applicationId: application.id,
                            approveToken: approveToken.token,
                            rejectToken: rejectToken.token,
                        }),
                    });
                })
            );
        } else if (notifyApplicant) {
            await createNotification({
                userId: application.applicant.id,
                title: eventLabel,
                message: `Your ${permitTypeName} application has been ${nextStatus.toLowerCase().replace(/_/g, " ")}.`,
                type: nextStatus === "APPROVED" ? "SUCCESS" : nextStatus === "REJECTED" ? "ERROR" : "WARNING",
                link: `/applications/${application.id}`,
            });
            await sendEmail({
                to: application.applicant.email,
                subject: `Application ${nextStatus === "APPROVED" ? "Approved" : nextStatus === "REJECTED" ? "Rejected" : "Requires Corrections"} — ${permitTypeName}`,
                html: decisionEmail({
                    applicantName: application.applicant.name || "Applicant",
                    permitType: permitTypeName,
                    decision: nextStatus as "APPROVED" | "REJECTED" | "REQUIRES_CORRECTION",
                    applicationId: application.id,
                    certificateNo,
                }),
            });
        }

        const resultMap: Record<string, string> = {
            RECOMMEND_APPROVAL: "recommended",
            FINAL_APPROVE: "approved",
            FINAL_REJECT: "rejected",
            REJECT: "rejected",
            REQUIRES_CORRECTION: "corrections",
        };
        const resultParam = resultMap[action] || "error";
        return NextResponse.redirect(`${appUrl}/email-action?result=${resultParam}&id=${application.id}`);
    } catch (error) {
        console.error("Email action error:", error);
        return NextResponse.redirect(`${appUrl}/email-action?result=error`);
    }
}
