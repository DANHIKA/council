import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WithdrawalMethodType } from "@prisma/client";

// Get admin's payment methods
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        });

        if (user?.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const paymentMethods = await prisma.paymentMethod.findMany({
            where: { adminId: session.user.id, isActive: true },
            orderBy: { isDefault: "desc" },
        });

        return NextResponse.json({ data: paymentMethods });
    } catch (error) {
        console.error("Get payment methods error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// Add new payment method
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        });

        if (user?.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { type, details, isDefault } = body;

        if (!type || !details) {
            return NextResponse.json({ error: "Type and details are required" }, { status: 400 });
        }

        if (!Object.values(WithdrawalMethodType).includes(type)) {
            return NextResponse.json({ error: "Invalid payment method type" }, { status: 400 });
        }

        // If setting as default, unset other defaults
        if (isDefault) {
            await prisma.paymentMethod.updateMany({
                where: { adminId: session.user.id, isDefault: true },
                data: { isDefault: false },
            });
        }

        const paymentMethod = await prisma.paymentMethod.create({
            data: {
                adminId: session.user.id,
                type,
                details,
                isDefault: isDefault || false,
            },
        });

        return NextResponse.json({ data: paymentMethod }, { status: 201 });
    } catch (error) {
        console.error("Create payment method error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
