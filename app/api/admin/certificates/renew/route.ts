import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const renewSchema = z.object({
    applicationId: z.string(),
});

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const userRole = (session.user as any).role as string;
        if (userRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const body = await req.json();
        const parsed = renewSchema.parse(body);

        const application = await prisma.permitApplication.findUnique({
            where: { id: parsed.applicationId },
            include: {
                certificate: true,
                permitTypeRef: { select: { name: true, validityMonths: true } },
                applicant: { select: { id: true, name: true, email: true } },
            },
        });

        if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });
        if (!application.certificate) return NextResponse.json({ error: "No certificate to renew" }, { status: 400 });

        // Check if certificate is expired or expiring within 30 days
        const now = new Date();
        const expiryDate = new Date(application.certificate.expiryDate);
        const thirtyDays = new Date();
        thirtyDays.setDate(now.getDate() + 30);

        if (expiryDate > thirtyDays) {
            return NextResponse.json({ error: "Certificate is still valid for more than 30 days" }, { status: 409 });
        }

        const validityMonths = application.permitTypeRef?.validityMonths ?? 12;
        const newExpiryDate = new Date(now);
        newExpiryDate.setMonth(newExpiryDate.getMonth() + validityMonths);

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const newCertNo = `RENEW-${application.certificate.certificateNo}`;

        // Create new certificate
        const newCert = await prisma.certificate.create({
            data: {
                applicationId: application.id,
                certificateNo: newCertNo,
                qrCode: `${appUrl}/api/applications/${application.id}/certificate/verify?cert=${newCertNo}`,
                issueDate: now,
                expiryDate: newExpiryDate,
            },
        });

        await prisma.timelineEvent.create({
            data: {
                applicationId: application.id,
                event: "Certificate Renewed",
                description: `Certificate renewed. New certificate: ${newCertNo}. Valid until ${newExpiryDate.toDateString()}.`,
                status: "APPROVED",
            },
        });

        // Audit log
        await logAudit({
            userId: session.user.id,
            action: "RENEW",
            entityType: "CERTIFICATE",
            entityId: application.id,
            description: `Renewed certificate for ${application.permitTypeRef?.name || application.permitType}`,
            metadata: { newCertificateNo: newCertNo, oldExpiry: expiryDate.toISOString(), newExpiry: newExpiryDate.toISOString() },
        });

        return NextResponse.json({ certificate: newCert, success: true });
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
        console.error("Certificate renewal error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
