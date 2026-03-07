import { prisma } from "@/lib/prisma";

interface CreateNotificationParams {
    userId: string;
    title: string;
    message: string;
    type: string;
    link?: string;
}

export async function createNotification({
    userId,
    title,
    message,
    type,
    link,
}: CreateNotificationParams) {
    try {
        return await prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type,
                link,
            },
        });
    } catch (error) {
        console.error("Failed to create notification:", error);
        return null;
    }
}
