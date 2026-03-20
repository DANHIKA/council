import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatWithOllama } from "@/lib/ollama";
import { getRelevantScenarios } from "@/lib/ai-scenarios";

const GREETING_RE = /^(hi|hello|hey|howdy|good\s*(morning|afternoon|evening)|greetings|what'?s up|sup|yo)[\s!?.]*$/i;
const THANKS_RE = /^(thanks?|thank you|cheers|got it|ok|okay|great|perfect|awesome|cool)[\s!.]*$/i;
const SOCIAL_RE = /^(how are you|how're you|how do you do|who are you|what are you|what can you do|what do you do)[\s!?.]*$/i;
const AFFIRMATIVE_RE = /^(yes|yeah|yep|yup|sure|ok|okay|go ahead|please|yes please|tell me|show me|yes tell me|of course|definitely|absolutely|i do|i would|yes i would)[\s!.,]*$/i;
const DOCS_RE = /\b(what documents?|what docs?|what do i need|documents? needed|requirements?|checklist|paperwork|list (of )?docs?|what (do|should) i (bring|submit|prepare))\b/i;

function matchPermit(query: string): { name: string; score: number } | null {
    const scenarios = getRelevantScenarios(query, 1);
    if (!scenarios.length) return null;
    const lower = query.toLowerCase();
    const score = scenarios[0].keywords.filter((k) => lower.includes(k)).length;
    return score > 0 ? { name: scenarios[0].recommendation, score } : null;
}

/** Scan previous messages to find the last permit name mentioned by the assistant */
function findLastPermitInHistory(messages: any[], permitNames: string[]): string | null {
    const assistantMsgs = [...messages].reverse().filter((m) => m.role === "assistant");
    for (const msg of assistantMsgs) {
        const content: string = msg.content || "";
        for (const name of permitNames) {
            if (content.toLowerCase().includes(name.toLowerCase())) return name;
        }
    }
    return null;
}

function buildDocsResponse(permit: { name: string; requirements: { label: string; required: boolean }[] }): string {
    const required = permit.requirements
        .filter((r) => r.required)
        .map((r) => `- ${r.label}`)
        .join("\n");
    const optional = permit.requirements
        .filter((r) => !r.required)
        .map((r) => `- ${r.label}`)
        .join("\n");

    let resp = `Here are the documents needed for a **${permit.name}** permit:\n\n**Required:**\n${required || "None listed"}`;
    if (optional) resp += `\n\n**Optional:**\n${optional}`;
    resp += "\n\nLet me know if you have any questions!";
    return resp;
}

export async function POST(req: NextRequest) {
    try {
        const { messages } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: "Messages are required" }, { status: 400 });
        }

        const lastUserMessage: string =
            messages.filter((m: any) => m.role === "user").pop()?.content?.trim() || "";

        // ── Instant canned responses (no DB needed) ───────────────────────
        if (GREETING_RE.test(lastUserMessage)) {
            return NextResponse.json({
                response:
                    "Hi there! I'm your Council Permit Assistant. Tell me what you're planning to build, start, or change — I'll point you to the right permit.",
            });
        }

        if (THANKS_RE.test(lastUserMessage)) {
            return NextResponse.json({
                response: "You're welcome! Feel free to ask if you need anything else.",
            });
        }

        if (SOCIAL_RE.test(lastUserMessage)) {
            return NextResponse.json({
                response:
                    "I'm a permit assistant for the local council — here to help you figure out which permit you need and what documents to prepare. What are you working on?",
            });
        }

        // ── Fetch permit data ─────────────────────────────────────────────
        const permitTypes = await prisma.permitType.findMany({
            include: { requirements: { select: { label: true, required: true } } },
        });
        const permitNames = permitTypes.map((p: { name: string }) => p.name);

        const needsDocs = DOCS_RE.test(lastUserMessage.toLowerCase());
        const isAffirmative = AFFIRMATIVE_RE.test(lastUserMessage);

        // ── "Yes / sure / tell me" — use conversation context ─────────────
        if (isAffirmative || needsDocs) {
            // Check if user mentioned a project in the same message
            const matchInMessage = !isAffirmative ? matchPermit(lastUserMessage) : null;

            // Or look back in history for the last permit we mentioned
            const permitName =
                matchInMessage?.name ?? findLastPermitInHistory(messages, permitNames);

            if (permitName) {
                const permit = permitTypes.find(
                    (p) => p.name.toLowerCase() === permitName.toLowerCase()
                );
                if (permit) {
                    return NextResponse.json({ response: buildDocsResponse(permit) });
                }
            }

            // No context found
            if (isAffirmative) {
                return NextResponse.json({
                    response:
                        "Sure! Could you tell me a bit about your project first so I know which permit's documents to show you?",
                });
            }
        }

        // ── Rule-based permit recommendation ─────────────────────────────
        const match = matchPermit(lastUserMessage);
        if (match) {
            const permit = permitTypes.find(
                (p) => p.name.toLowerCase() === match.name.toLowerCase()
            );
            if (permit) {
                const desc = permit.description ? ` — ${permit.description.toLowerCase()}` : "";
                const response = `You'll need a **${permit.name}** permit for that${desc}. Would you like the list of required documents?`;
                return NextResponse.json({ response });
            }
        }

        // ── Fallback: minimal LLM with only permit names, tiny token budget ─
        const systemContent =
            `Council permit assistant. One sentence only. Available permits: ${permitNames.join(", ")}.`;

        const responseText = await chatWithOllama(
            [{ role: "system" as const, content: systemContent }, ...messages],
            80
        );

        return NextResponse.json({ response: responseText });
    } catch (error: any) {
        console.error("AI Chat error:", error);
        const isOllamaError =
            error?.message?.includes("Ollama") || error?.message?.includes("connection");
        if (isOllamaError) {
            return NextResponse.json(
                { response: "The AI service is temporarily unavailable. Please try again." },
                { status: 503 }
            );
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
