import { prisma } from "@/lib/prisma";

export async function logAudit(data: {
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    description?: string;
    metadata?: Record<string, any>;
}) {
    try {
        await prisma.auditLog.create({
            data: {
                userId: data.userId,
                action: data.action,
                entityType: data.entityType,
                entityId: data.entityId,
                description: data.description,
                metadata: data.metadata,
            },
        });
    } catch (e) {
        // Don't break the main flow if audit logging fails
        console.error("Audit log error:", e);
    }
}
