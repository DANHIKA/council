import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geminiModel } from "@/lib/gemini";

export async function POST(req: NextRequest) {
    try {
        const { messages } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: "Messages are required" }, { status: 400 });
        }

        const permitTypes = await prisma.permitType.findMany({
            select: { name: true, description: true }
        });

        const permitInfo = permitTypes.map(pt => `- ${pt.name}: ${pt.description}`).join('\n');

        const systemPrompt = `
            You are a helpful Council Assistant for the Council Permit Portal.
            You help citizens with permit-related questions.
            Be polite, professional, and concise.
            If you don't know the answer, suggest contacting the council directly.
            
            Available Permit Types at this council:
            ${permitInfo}
            
            Answer based ONLY on the available permits if the user asks about what permits are available.
        `;

        const chat = geminiModel?.startChat({
            history: [
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "model", parts: [{ text: "Understood. I am now the Council Assistant. How can I help you today?" }] },
                ...messages.slice(0, -1).map((m: any) => ({
                    role: m.role === "user" ? "user" : "model",
                    parts: [{ text: m.content }]
                }))
            ],
        });

        const lastMessage = messages[messages.length - 1].content;
        const result = await chat?.sendMessage(lastMessage);
        const responseText = result?.response.text();

        return NextResponse.json({ response: responseText });
    } catch (error) {
        console.error("AI Chat error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
