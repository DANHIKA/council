import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyOfficersNewApplication } from "@/lib/notify-officers";

const PAYCHANGU_VERIFY = "https://api.paychangu.com/verify-payment";

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const txRef = searchParams.get("tx_ref");
    const paychanguTxId = searchParams.get("transaction_id") ?? undefined;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    if (!txRef) {
        return NextResponse.redirect(`${appUrl}/dashboard?payment=error`);
    }

    try {
        // Find our payment record
        const payment = await prisma.payment.findUnique({
            where: { txRef },
            include: { application: { select: { id: true, status: true } } },
        });

        if (!payment) {
            return NextResponse.redirect(`${appUrl}/dashboard?payment=error`);
        }

        const applicationId = payment.application.id;

        // Verify with Paychangu
        const verifyRes = await fetch(`${PAYCHANGU_VERIFY}/${txRef}`, {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
            },
        });

        const verifyData = await verifyRes.json();
        const status = verifyData?.data?.status ?? verifyData?.status;
        const isSuccess = status === "success" || status === "successful" || status === "SUCCESSFUL";

        if (isSuccess) {
            await prisma.$transaction([
                prisma.payment.update({
                    where: { txRef },
                    data: {
                        status: "PAID",
                        paychanguTxId: paychanguTxId ?? verifyData?.data?.id ?? null,
                    },
                }),
            ]);

            // Auto-submit if not already under review (webhook might not have fired yet)
            if (payment.application.status === "SUBMITTED") {
                await prisma.permitApplication.update({
                    where: { id: applicationId },
                    data: { status: "UNDER_REVIEW" },
                });

                await prisma.timelineEvent.create({
                    data: {
                        applicationId,
                        event: "Application Submitted",
                        description: "Application submitted after payment confirmation.",
                        status: "UNDER_REVIEW",
                    },
                });

                // Notify officers now that payment is confirmed and app is ready for review
                await notifyOfficersNewApplication(applicationId);
            }

            return NextResponse.redirect(
                `${appUrl}/applications/${applicationId}?payment=success`
            );
        } else {
            await prisma.payment.update({
                where: { txRef },
                data: { status: "FAILED" },
            });

            return NextResponse.redirect(
                `${appUrl}/applications/${applicationId}?payment=failed`
            );
        }
    } catch (error) {
        console.error("Payment callback error:", error);
        return NextResponse.redirect(`${appUrl}/dashboard?payment=error`);
    }
}
