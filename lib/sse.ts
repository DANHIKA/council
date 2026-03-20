/**
 * Global SSE connection registry.
 * Works on single-server deployments (dev / school project).
 * Each user can have multiple tabs open — all get the event.
 */

type Controller = ReadableStreamDefaultController<Uint8Array>;

const connections = new Map<string, Set<Controller>>();

export function addConnection(userId: string, controller: Controller) {
    if (!connections.has(userId)) connections.set(userId, new Set());
    connections.get(userId)!.add(controller);
}

export function removeConnection(userId: string, controller: Controller) {
    connections.get(userId)?.delete(controller);
    if (connections.get(userId)?.size === 0) connections.delete(userId);
}

export function pushToUser(userId: string, event: string, data: object) {
    const userConns = connections.get(userId);
    if (!userConns?.size) return;

    const msg = new TextEncoder().encode(
        `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    );

    for (const ctrl of userConns) {
        try {
            ctrl.enqueue(msg);
        } catch {
            userConns.delete(ctrl);
        }
    }
}
