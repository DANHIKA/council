import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generate } from "@/lib/ai-provider";

// Save messages to a session and increment count
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId, messages } = await req.json();

        if (!sessionId || !messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: "sessionId and messages are required" }, { status: 400 });
        }

        // Verify ownership
        const chatSession = await prisma.chatSession.findUnique({
            where: { id: sessionId, userId: session.user.id },
        });

        if (!chatSession) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        // Save messages
        await prisma.chatMessage.createMany({
            data: messages.map((m: any) => ({
                sessionId,
                role: m.role,
                content: m.content,
            })),
        });

        // Update message count and timestamp
        await prisma.chatSession.update({
            where: { id: sessionId },
            data: {
                messageCount: chatSession.messageCount + messages.length,
                updatedAt: new Date(),
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Save messages error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// Generate a title for a chat session based on the first user message
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = req.nextUrl;
        const message = searchParams.get("message");

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        // Use AI to generate a short title (max 40 chars)
        const prompt = `Generate a short title (max 40 characters) for this chat conversation. Reply with ONLY the title, no quotes, no explanation.

Message: "${message}"`;

        const title = (await generate(prompt, 40)).trim().replace(/^["']|["']$/g, "");

        return NextResponse.json({ title });
    } catch (error) {
        console.error("Generate title error:", error);
        return NextResponse.json({ title: "New Chat" });
    }
}

// Compaction: summarize a long conversation into a brief summary for AI context
export async function PATCH(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId } = await req.json();

        if (!sessionId) {
            return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
        }

        // Verify ownership
        const chatSession = await prisma.chatSession.findUnique({
            where: { id: sessionId, userId: session.user.id },
        });

        if (!chatSession) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        // Fetch all messages
        const messages = await prisma.chatMessage.findMany({
            where: { sessionId },
            orderBy: { createdAt: "asc" },
        });

        if (messages.length < 10) {
            return NextResponse.json({ summary: null });
        }

        // Build conversation text
        const convoText = messages
            .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
            .join("\n");

        // Ask AI to summarize
        const prompt = `Summarize this council permit conversation in 2-3 sentences. Focus on: what the user was asking about, what was recommended, and any key decisions. Be concise.

Conversation:
${convoText}`;

        const summary = (await generate(prompt, 100)).trim();

        // Save summary to session
        await prisma.chatSession.update({
            where: { id: sessionId },
            data: { summary },
        });

        return NextResponse.json({ summary });
    } catch (error) {
        console.error("Compaction error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
