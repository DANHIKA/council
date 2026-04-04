import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generate, chat } from "@/lib/ai-provider";
import { getRelevantScenarios } from "@/lib/ai-scenarios";
import type { Message } from "@/lib/ai-provider";
import type { ProposedAction } from "@/components/chat/action-card";

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

// ── Navigate action classifier ────────────────────────────────────────────────

async function classifyNavigateAction(msg: string): Promise<"start_application" | "view_applications" | null> {
  const prompt = `Does this message indicate the user wants to navigate somewhere? Reply with ONLY the intent or "none".

Intents:
start_application  – wants to apply, start a new permit application, how do I apply
view_applications  – wants to see their applications, check application status, view my submissions

Message: "${msg}"`;

  const raw = (await generate(prompt, 15)).trim().toLowerCase();
  if (raw === "start_application") return "start_application";
  if (raw === "view_applications") return "view_applications";
  return null;
}

// ── Route ─────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  `You are a friendly council permit assistant helping members of the public. ` +
  `Be warm, clear, and conversational — like a helpful receptionist who knows permits inside out. ` +
  `Keep answers concise. If you have data, weave it naturally into your reply. ` +
  `When a navigation action is identified, briefly acknowledge it and note the card below will take them there.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, provider, includeVisualization, includeActions } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 });
    }

    const lastMessage: string =
      messages.filter((m: any) => m.role === "user").pop()?.content?.trim() || "";

    // 1. Run classifiers in parallel
    const [intent, vizIntent, navAction] = await Promise.all([
      classifyIntent(lastMessage),
      includeVisualization ? classifyVisualization(lastMessage) : Promise.resolve(null),
      includeActions ? classifyNavigateAction(lastMessage) : Promise.resolve(null),
    ]);

    // 2. Fetch visualization data
    const visualizationData = vizIntent ? await fetchVisualizationData(vizIntent) : null;

    // 3. Build action proposal
    let actionData: ProposedAction | null = null;
    if (navAction === "start_application") {
      actionData = {
        type: "navigate",
        label: "Start New Application",
        description: "Begin a new permit application",
        href: "/applications/new",
      };
    } else if (navAction === "view_applications") {
      actionData = {
        type: "navigate",
        label: "View My Applications",
        description: "See all your permit applications and their status",
        href: "/applications",
      };
    }

    // 4. Fetch relevant data and build enriched system prompt
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

    if (actionData) {
      systemWithData += `\n\nNavigation action identified: "${actionData.label}". Briefly acknowledge and mention the card below is ready.`;
    }

    // 5. AI writes the response
    const response = await chat(
      [{ role: "system", content: systemWithData }, ...(messages as Message[])],
      150,
      provider
    );

    return NextResponse.json({
      response,
      visualization: visualizationData,
      action: actionData,
    });
  } catch (error: any) {
    console.error("AI Chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
