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

        const application = await prisma.permitApplication.findUnique({
            where: { id },
            select: { id: true, applicantId: true, certificate: true },
        });

        if (!application) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }

        if (!application.certificate) {
            return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
        }

        const userRole = (session.user as any).role as string | undefined;
        const isOwner = application.applicantId === session.user.id;
        const isStaff = userRole === "OFFICER" || userRole === "ADMIN";

        if (!isOwner && !isStaff) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prisma.certificate.update({
            where: { id: application.certificate.id },
            data: { downloadCount: { increment: 1 } },
        });

        const pdf = Buffer.from(`Certificate PDF placeholder for ${application.certificate.certificateNo}`, "utf-8");

        return new NextResponse(pdf, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="certificate-${application.certificate.certificateNo}.pdf"`,
                "Content-Length": pdf.length.toString(),
            },
        });
    } catch (error) {
        console.error("Certificate download error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
