import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHmac } from "crypto";
import { createNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
    try {
        const body = await req.text();

        // Verify webhook signature
        const signature = req.headers.get("verif-hash") ?? req.headers.get("x-paychangu-signature");
        const webhookSecret = process.env.PAYCHANGU_WEBHOOK_SECRET;

        if (webhookSecret && signature) {
            const expected = createHmac("sha256", webhookSecret).update(body).digest("hex");
            if (expected !== signature) {
                return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
            }
        }

        const payload = JSON.parse(body);
        const event = payload?.event ?? payload?.type;
        const txRef = payload?.data?.tx_ref ?? payload?.tx_ref;
        const paychanguTxId = payload?.data?.id ?? payload?.id;
        const status = payload?.data?.status ?? payload?.status;

        if (!txRef) {
            return NextResponse.json({ received: true });
        }

        const isSuccess = status === "success" || status === "successful" || status === "SUCCESSFUL";

        const payment = await prisma.payment.findUnique({
            where: { txRef },
            include: { application: { select: { id: true } } },
        });

        if (!payment) {
            return NextResponse.json({ received: true });
        }

        // Idempotent — don't downgrade a PAID status
        if (payment.status === "PAID") {
            return NextResponse.json({ received: true });
        }

        const newStatus = isSuccess ? "PAID" : "FAILED";

        await prisma.$transaction([
            prisma.payment.update({
                where: { txRef },
                data: {
                    status: newStatus,
                    paychanguTxId: paychanguTxId ?? payment.paychanguTxId,
                },
            }),
            prisma.permitApplication.update({
                where: { id: payment.application.id },
                data: { paymentStatus: newStatus },
            }),
        ]);

        if (isSuccess) {
            const app = await prisma.permitApplication.findUnique({
                where: { id: payment.application.id },
                select: { applicantId: true },
            });
            if (app) {
                await createNotification({
                    userId: app.applicantId,
                    title: "Payment confirmed",
                    message: `Your application fee of ${payment.currency} ${Number(payment.amount).toLocaleString()} has been received.`,
                    type: "PAYMENT",
                    link: `/applications/${payment.application.id}`,
                });
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("Webhook error:", error);
        // Always return 200 to prevent Paychangu from retrying on our own errors
        return NextResponse.json({ received: true });
    }
}
