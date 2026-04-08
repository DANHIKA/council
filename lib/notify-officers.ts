import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { newApplicationEmail } from "@/lib/email-templates";

/**
 * Notify all officers/admins of a new application ready for review.
 * Idempotent: skips if review tokens already exist for this application.
 */
export async function notifyOfficersNewApplication(applicationId: string) {
    // Idempotency guard — don't notify twice
    const existing = await prisma.reviewToken.findFirst({ where: { applicationId } });
    if (existing) return;

    const application = await prisma.permitApplication.findUnique({
        where: { id: applicationId },
        include: {
            applicant: { select: { name: true, email: true } },
            permitTypeRef: { select: { name: true } },
        },
    });
    if (!application) return;

    const permitTypeName = application.permitTypeRef?.name ?? application.permitType;

    const officers = await prisma.user.findMany({
        where: { role: { in: ["OFFICER", "ADMIN"] } },
        select: { id: true, name: true, email: true },
    });

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await Promise.all(
        officers.map(async (officer) => {
            const [recommendToken, correctionsToken, rejectToken] = await Promise.all([
                prisma.reviewToken.create({
                    data: { applicationId, officerId: officer.id, action: "RECOMMEND_APPROVAL", expiresAt },
                }),
                prisma.reviewToken.create({
                    data: { applicationId, officerId: officer.id, action: "REQUIRES_CORRECTION", expiresAt },
                }),
                prisma.reviewToken.create({
                    data: { applicationId, officerId: officer.id, action: "REJECT", expiresAt },
                }),
            ]);

            await createNotification({
                userId: officer.id,
                title: "New Application Submitted",
                message: `A new ${permitTypeName} application from ${application.applicant.name} is awaiting review.`,
                type: "INFO",
                link: `/officer/review/${applicationId}`,
            });

            await sendEmail({
                to: officer.email,
                subject: `New Application for Review: ${permitTypeName}`,
                html: newApplicationEmail({
                    officerName: officer.name || "Officer",
                    applicantName: application.applicant.name || "Applicant",
                    applicantEmail: application.applicant.email,
                    permitType: permitTypeName,
                    description: application.description,
                    location: application.location,
                    applicationId,
                    recommendToken: recommendToken.token,
                    correctionsToken: correctionsToken.token,
                    rejectToken: rejectToken.token,
                }),
            });
        })
    );
}
