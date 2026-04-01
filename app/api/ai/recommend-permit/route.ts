import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generate } from "@/lib/ai-provider";
import { getRelevantScenarios } from "@/lib/ai-scenarios";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { description, provider } = body;

    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    const permitTypes = await prisma.permitType.findMany({
      select: { name: true, description: true },
    }) as { name: string; description: string | null }[];

    const scenarios = getRelevantScenarios(description)
      .map(s => `Project: "${s.query}" → ${s.recommendation} (${s.explanation})`)
      .join("\n");

    const permitList = permitTypes.map(p => `- ${p.name}: ${p.description ?? ""}`).join("\n");

    const prompt = `You are a council permit advisor. Based on the project description, recommend the most appropriate permit and explain why in a friendly, helpful way.

Available permits:
${permitList}

Similar past cases:
${scenarios}

Project: "${description}"

Reply with JSON only — no markdown, no extra text:
{"recommendation": "<exact permit name from the list>", "explanation": "<2-3 sentence natural explanation — why this permit fits, what it covers, and what to expect>"}`;

    const raw = await generate(prompt, 200, provider);

    // Extract JSON even if the model wraps it in markdown
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        // Validate the recommendation is a real permit name
        const matched = permitTypes.find(
          p => p.name.toLowerCase() === (parsed.recommendation ?? "").toLowerCase()
        );
        if (matched) {
          return NextResponse.json({
            recommendation: matched.name,
            explanation: parsed.explanation ?? "This permit fits your project description.",
          });
        }
      } catch {
        // fall through to name-matching below
      }
    }

    // Safety net: find any permit name mentioned in the response
    const lower = raw.toLowerCase();
    const found = permitTypes.find(p => lower.includes(p.name.toLowerCase()));
    if (found) {
      return NextResponse.json({
        recommendation: found.name,
        explanation: "This permit matches your project description.",
      });
    }

    return NextResponse.json({
      recommendation: "Manual Selection Required",
      explanation: "I wasn't able to pinpoint the exact permit from your description. Have a look at the list above and pick the one that best fits — or add a bit more detail and try again.",
    });
  } catch (error: any) {
    console.error("Permit recommendation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
