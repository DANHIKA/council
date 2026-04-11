import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// List all sessions for the current user
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = req.nextUrl;
        const sessionId = searchParams.get("id");

        if (sessionId) {
            // Get a single session with messages
            const chatSession = await prisma.chatSession.findUnique({
                where: { id: sessionId, userId: session.user.id },
                include: {
                    messages: { orderBy: { createdAt: "asc" } },
                },
            });

            if (!chatSession) {
                return NextResponse.json({ error: "Session not found" }, { status: 404 });
            }

            return NextResponse.json(chatSession);
        }

        // List sessions (sorted by most recent)
        const sessions = await prisma.chatSession.findMany({
            where: { userId: session.user.id },
            select: {
                id: true,
                title: true,
                summary: true,
                provider: true,
                messageCount: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
            take: 50,
        });

        return NextResponse.json(sessions);
    } catch (error) {
        console.error("Chat sessions list error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// Create a new chat session
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { title, provider = "groq" } = await req.json();

        if (!title) {
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }

        const chatSession = await prisma.chatSession.create({
            data: {
                userId: session.user.id,
                title,
                provider,
            },
        });

        return NextResponse.json(chatSession);
    } catch (error) {
        console.error("Chat session create error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// Update session (title, summary)
export async function PATCH(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = req.nextUrl;
        const sessionId = searchParams.get("id");

        if (!sessionId) {
            return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
        }

        const { title, summary } = await req.json();

        const updated = await prisma.chatSession.updateMany({
            where: { id: sessionId, userId: session.user.id },
            data: {
                ...(title && { title }),
                ...(summary && { summary }),
                updatedAt: new Date(),
            },
        });

        if (updated.count === 0) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Chat session update error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// Delete a session
export async function DELETE(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = req.nextUrl;
        const sessionId = searchParams.get("id");

        if (!sessionId) {
            return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
        }

        const deleted = await prisma.chatSession.deleteMany({
            where: { id: sessionId, userId: session.user.id },
        });

        if (deleted.count === 0) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Chat session delete error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
