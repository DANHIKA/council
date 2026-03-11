import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatWithOllama, compactContext } from "@/lib/ollama";
import { getRelevantScenarios } from "@/lib/ai-scenarios";

export async function POST(req: NextRequest) {
    try {
        const { messages } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: "Messages are required" }, { status: 400 });
        }

        // Get the last message to find relevant examples
        const lastUserMessage = messages.filter(m => m.role === "user").pop()?.content || "";
        const relevantScenarios = getRelevantScenarios(lastUserMessage, 3);
        
        const scenarioContext = relevantScenarios.map(s => 
            `Example Case: "${s.query}" -> This requires a ${s.recommendation} because ${s.explanation}`
        ).join("\n");

        const permitTypes = await prisma.permitType.findMany({
            include: {
                requirements: {
                    select: { label: true, required: true }
                }
            }
        });

        const permitInfo = compactContext(permitTypes, (pt: any) => {
            const reqs = pt.requirements.map((r: { label: string; required: boolean }) => 
                `${r.label}${r.required ? " (Mandatory)" : ""}`
            ).join(", ");
            return `${pt.name}: ${pt.description}. Requirements: ${reqs}`;
        });

        const systemMessage = {
            role: "system",
            content: `You are the Council Assistant. You help citizens apply for permits. 
Guidelines:
- Be concise and professional.
- Use the following real-world examples to guide your advice:
${scenarioContext}

- Available permits and their requirements: ${permitInfo}.
- If a user asks 'Can I...' or 'How do I...', map their project to the closest permit type above.`
        };

        const responseText = await chatWithOllama([systemMessage, ...messages]);

        return NextResponse.json({ response: responseText });
    } catch (error: any) {
        console.error("AI Chat error:", error);
        
        // Handle specific API quota errors
        const isQuotaError = error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("quota");
        if (isQuotaError) {
            return NextResponse.json({ 
                error: "AI is currently busy", 
                response: "I'm receiving too many messages right now. Please wait a few seconds and try again." 
            }, { status: 429 });
        }

        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
