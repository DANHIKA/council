import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generate, chat } from "@/lib/ai-provider";
import { getRelevantScenarios } from "@/lib/ai-scenarios";
import type { Message } from "@/lib/ai-provider";

// ── Intent classification ─────────────────────────────────────────────────────

const INTENTS = ["greeting", "permit_recommendation", "document_requirements", "conversation"] as const;
type Intent = typeof INTENTS[number];

const VISUALIZATION_INTENTS = [
  "chart_permit_types", "table_permit_types", "table_requirements", "stats_summary",
] as const;
type VisualizationIntent = typeof VISUALIZATION_INTENTS[number] | null;

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

async function classifyVisualization(msg: string): Promise<VisualizationIntent> {
  const prompt = `Does this message request a chart, table, or statistics visualization about permits? Reply with ONLY the intent name or "none".

Visualization intents:
chart_permit_types   – bar/pie chart showing available permit types
table_permit_types   – table of all permit types with descriptions
table_requirements   – table showing document requirements for permits
stats_summary        – summary statistics about permits

Message: "${msg}"`;

  const raw = (await generate(prompt, 20)).trim().toLowerCase();
  return (VISUALIZATION_INTENTS as readonly string[]).includes(raw) ? (raw as VisualizationIntent) : null;
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchVisualizationData(intent: VisualizationIntent): Promise<any> {
  switch (intent) {
    case "chart_permit_types": {
      const permitTypes = await prisma.permitType.findMany({
        include: { _count: { select: { applications: true } } },
        orderBy: { name: "asc" },
      });
      const data = permitTypes
        .map((p) => ({ name: p.name, value: p._count.applications || 0 }))
        .filter((d) => d.value > 0);
      
      if (data.length === 0) {
        return {
          type: "chart",
          chart: {
            title: "Permit Types",
            type: "bar" as const,
            data: [{ name: "No applications", value: 1 }],
          },
        };
      }
      
      return {
        type: "chart",
        chart: {
          title: "Applications by Permit Type",
          type: "horizontalBar" as const,
          data,
        },
      };
    }

    case "table_permit_types": {
      const permitTypes = await prisma.permitType.findMany({
        orderBy: { name: "asc" },
      });
      return {
        type: "table",
        table: {
          title: "Available Permit Types",
          columns: [
            { key: "name", header: "Permit Type" },
            { key: "description", header: "Description" },
          ],
          data: permitTypes.map((p) => ({
            name: p.name,
            description: p.description || "No description",
          })),
        },
      };
    }

    case "table_requirements": {
      const permitTypes = await prisma.permitType.findMany({
        include: { requirements: { select: { label: true, required: true } } },
        orderBy: { name: "asc" },
      });
      const data = permitTypes.flatMap((p) =>
        p.requirements.map((r) => ({
          permitType: p.name,
          requirement: r.label,
          type: r.required ? "Required" : "Optional",
        }))
      );
      return {
        type: "table",
        table: {
          title: "Permit Requirements",
          columns: [
            { key: "permitType", header: "Permit Type" },
            { key: "requirement", header: "Requirement" },
            { key: "type", header: "Type", type: "badge" as const },
          ],
          data,
        },
      };
    }

    case "stats_summary": {
      const [totalPermits, totalRequirements, activePermits] = await Promise.all([
        prisma.permitType.count(),
        prisma.permitRequirement.count(),
        prisma.permitApplication.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "PENDING_APPROVAL"] } } }),
      ]);
      return {
        type: "stats",
        stats: [
          { label: "Permit Types", value: totalPermits },
          { label: "Total Requirements", value: totalRequirements },
          { label: "Active Applications", value: activePermits },
          { label: "Available", value: "24/7" },
        ],
      };
    }

    default:
      return null;
  }
}

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
    const { messages, provider, includeVisualization } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 });
    }

    const lastMessage: string =
      messages.filter((m: any) => m.role === "user").pop()?.content?.trim() || "";

    // 1. Classify intent
    const intent = await classifyIntent(lastMessage);

    // 2. Check for visualization request if enabled
    let visualizationData: any = null;
    if (includeVisualization) {
      const vizIntent = await classifyVisualization(lastMessage);
      if (vizIntent) {
        visualizationData = await fetchVisualizationData(vizIntent);
      }
    }

    // 3. Fetch relevant data and build enriched system prompt
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

    // 4. AI writes the response
    const response = await chat(
      [{ role: "system", content: systemWithData }, ...(messages as Message[])],
      150,
      provider
    );

    return NextResponse.json({ 
      response,
      visualization: visualizationData,
    });
  } catch (error: any) {
    console.error("AI Chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
