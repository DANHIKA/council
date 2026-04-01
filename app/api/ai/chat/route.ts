import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generate, chat } from "@/lib/ai-provider";
import { getRelevantScenarios } from "@/lib/ai-scenarios";
import type { Message } from "@/lib/ai-provider";

// ── Intent classification ─────────────────────────────────────────────────────

const INTENTS = ["greeting", "permit_recommendation", "document_requirements", "conversation"] as const;
type Intent = typeof INTENTS[number];

async function classifyIntent(msg: string): Promise<Intent> {
  const prompt = `Classify this message from a permit applicant into exactly one intent. Reply with ONLY the intent name.

Intents:
greeting              – hello, hi, how are you, social pleasantries
permit_recommendation – what permit do I need, I want to build/open/start X, which permit for Y
document_requirements – what documents do I need, what should I bring, checklist, requirements
conversation          – anything else

Message: "${msg}"`;

  const raw = (await generate(prompt, 10)).trim().toLowerCase();
  return (INTENTS as readonly string[]).includes(raw) ? (raw as Intent) : "conversation";
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchPermitData(description: string) {
  const permitTypes = await prisma.permitType.findMany({
    include: { requirements: { select: { label: true, required: true } } },
  });
  const scenarios = getRelevantScenarios(description)
    .map(s => `Project: "${s.query}" → ${s.recommendation}`)
    .join("\n");
  return { permitTypes, scenarios };
}

async function fetchDocRequirements(messages: Message[]) {
  const permitTypes = await prisma.permitType.findMany({
    include: { requirements: { select: { label: true, required: true } } },
  });

  // Find the most recently mentioned permit in the conversation
  const allText = messages
    .filter(m => m.role === "assistant")
    .map(m => m.content)
    .join(" ")
    .toLowerCase();

  const mentioned = permitTypes.find(p => allText.includes(p.name.toLowerCase()));
  return { permitTypes, mentionedPermit: mentioned ?? null };
}

// ── Route ─────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  `You are a friendly council permit assistant helping members of the public. ` +
  `Be warm, clear, and conversational — like a helpful receptionist who knows permits inside out. ` +
  `Keep answers concise. If you have data, weave it naturally into your reply.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, provider } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 });
    }

    const lastMessage: string =
      messages.filter((m: any) => m.role === "user").pop()?.content?.trim() || "";

    // 1. Classify intent
    const intent = await classifyIntent(lastMessage);

    // 2. Fetch relevant data and build enriched system prompt
    let systemWithData = SYSTEM_PROMPT;

    if (intent === "permit_recommendation") {
      const { permitTypes, scenarios } = await fetchPermitData(lastMessage);
      const permitList = permitTypes.map(p => `- ${p.name}: ${p.description ?? ""}`).join("\n");
      systemWithData += `\n\nAvailable permits:\n${permitList}\n\nSimilar past cases:\n${scenarios}\n\nRecommend the best permit and explain why in a friendly way. Offer to list the required documents if they want.`;
    }

    if (intent === "document_requirements") {
      const { permitTypes, mentionedPermit } = await fetchDocRequirements(messages as Message[]);
      if (mentionedPermit) {
        const required = mentionedPermit.requirements.filter(r => r.required).map(r => r.label);
        const optional = mentionedPermit.requirements.filter(r => !r.required).map(r => r.label);
        systemWithData += `\n\nPermit: ${mentionedPermit.name}\nRequired documents: ${required.join(", ") || "none listed"}\nOptional documents: ${optional.join(", ") || "none"}\n\nExplain these requirements naturally and helpfully.`;
      } else {
        const permitList = permitTypes.map(p => p.name).join(", ");
        systemWithData += `\n\nAvailable permit types: ${permitList}\n\nAsk which permit they're applying for so you can give them the exact document list.`;
      }
    }

    // 3. AI writes the response
    const response = await chat(
      [{ role: "system", content: systemWithData }, ...(messages as Message[])],
      150,
      provider
    );

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error("AI Chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
