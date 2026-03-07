import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const notifications = await prisma.notification.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: "desc" },
            take: 20,
        });

        const unreadCount = await prisma.notification.count({
            where: { userId: session.user.id, read: false },
        });

        return NextResponse.json({ notifications, unreadCount });
    } catch (error) {
        console.error("Fetch notifications error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await prisma.notification.updateMany({
            where: { userId: session.user.id, read: false },
            data: { read: true },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Mark all read error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
