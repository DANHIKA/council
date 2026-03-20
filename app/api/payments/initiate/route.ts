import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

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
                permitTypeRef: { select: { fee: true, currency: true, name: true } },
                payment: true,
            },
        });

        if (!application) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }
        if (application.applicantId !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (application.paymentStatus === "PAID") {
            return NextResponse.json({ error: "Already paid" }, { status: 400 });
        }

        const fee = Number(application.permitTypeRef?.fee ?? 0);
        const currency = application.permitTypeRef?.currency ?? "MWK";

        // If fee is 0 — waive automatically
        if (fee <= 0) {
            await prisma.permitApplication.update({
                where: { id: applicationId },
                data: { paymentStatus: "WAIVED" },
            });
            return NextResponse.json({ waived: true });
        }

        // Reuse existing pending payment's txRef if it exists
        const txRef = application.payment?.txRef ?? `PERMIT-${applicationId.slice(-8).toUpperCase()}-${Date.now()}`;

        // Upsert payment record
        await prisma.payment.upsert({
            where: { applicationId },
            create: {
                txRef,
                amount: fee,
                currency,
                status: "PENDING",
                applicationId,
            },
            update: { txRef, status: "PENDING" },
        });

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const nameParts = (application.applicant.name ?? "Applicant").split(" ");

        // Call Paychangu Standard Checkout API
        const response = await fetch(PAYCHANGU_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                secret_key: process.env.PAYCHANGU_SECRET_KEY,
                callback_url: `${appUrl}/api/payments/callback`,
                return_url: `${appUrl}/applications/${applicationId}?payment=cancelled`,
                currency,
                amount: fee,
                tx_ref: txRef,
                first_name: nameParts[0] ?? "Applicant",
                last_name: nameParts.slice(1).join(" ") || "-",
                email: application.applicant.email,
                metadata: { applicationId },
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
