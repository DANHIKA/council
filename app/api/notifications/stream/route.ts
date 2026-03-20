import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { addConnection, removeConnection } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return new Response("Unauthorized", { status: 401 });
    }

    const userId = session.user.id;
    const encoder = new TextEncoder();
    let ctrl: ReadableStreamDefaultController<Uint8Array>;

    const stream = new ReadableStream<Uint8Array>({
        start(c) {
            ctrl = c;
            addConnection(userId, c);
            // confirm connection
            c.enqueue(encoder.encode(": connected\n\n"));
        },
        cancel() {
            removeConnection(userId, ctrl);
        },
    });

    // Heartbeat every 25 s so proxies/browsers don't close the connection
    const hb = setInterval(() => {
        try {
            ctrl.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
            clearInterval(hb);
        }
    }, 25_000);

    req.signal.addEventListener("abort", () => {
        clearInterval(hb);
        removeConnection(userId, ctrl);
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
