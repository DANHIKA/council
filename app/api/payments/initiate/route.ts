import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAYCHANGU_API = "https://api.paychangu.com/payment";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { applicationId } = await req.json();
        if (!applicationId) {
            return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
        }

        // Load application + permit type fee
        const application = await prisma.permitApplication.findUnique({
            where: { id: applicationId },
            include: {
                applicant: { select: { id: true, name: true, email: true } },
                permitTypeRef: { select: { currency: true, name: true, applicationFee: true } },
                payments: true,
            },
        });

        if (!application) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }
        if (application.applicantId !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const fee = Number(application.permitTypeRef?.applicationFee ?? 0);
        const currency = application.permitTypeRef?.currency ?? "MWK";

        // If fee is 0 — waive automatically
        if (fee <= 0) {
            return NextResponse.json({ waived: true });
        }

        // Reuse existing pending payment's txRef if it exists
        const txRef = application.payments?.[0]?.txRef ?? `PERMIT-${applicationId.slice(-8).toUpperCase()}-${Date.now()}`;

        // Upsert payment record
        await prisma.payment.upsert({
            where: { txRef },
            create: {
                txRef,
                amount: fee,
                currency,
                status: "PENDING",
                applicationId,
            },
            update: { status: "PENDING" },
        });

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const nameParts = (application.applicant.name ?? "Applicant").split(" ");

        // Call Paychangu Standard Checkout API
        const response = await fetch(PAYCHANGU_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
            },
            body: JSON.stringify({
                callback_url: `${appUrl}/api/payments/callback`,
                return_url: `${appUrl}/applications/${applicationId}?payment=cancelled`,
                currency,
                amount: fee,
                tx_ref: txRef,
                first_name: nameParts[0] ?? "Applicant",
                last_name: nameParts.slice(1).join(" ") || "-",
                email: application.applicant.email,
                customization: {
                    title: `${application.permitTypeRef?.name ?? "Permit"} - Application Fee`,
                    description: `Payment for ${application.permitTypeRef?.name ?? "permit"} application`,
                },
                meta: { applicationId },
            }),
        });

        const data = await response.json();

        if (!response.ok || !data.checkout_url) {
            console.error("Paychangu error:", data);
            return NextResponse.json({ error: data.message ?? "Payment initiation failed" }, { status: 502 });
        }

        return NextResponse.json({
            checkoutUrl: data.checkout_url,
            txRef: data.tx_ref ?? txRef,
            amount: fee,
            currency,
        });
    } catch (error) {
        console.error("Payment initiate error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}