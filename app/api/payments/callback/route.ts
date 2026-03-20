import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
            include: { application: { select: { id: true } } },
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
                prisma.permitApplication.update({
                    where: { id: applicationId },
                    data: { paymentStatus: "PAID" },
                }),
            ]);

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
