import { prisma } from "@/lib/prisma";
import { pushToUser } from "@/lib/sse";

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
        const notification = await prisma.notification.create({
            data: { userId, title, message, type, link },
        });

        // Push live event to any open tabs for this user
        pushToUser(userId, "notification", {
            id: notification.id,
            title,
            message,
            type,
            link,
        });

        return notification;
    } catch (error) {
        console.error("Failed to create notification:", error);
        return null;
    }
}
