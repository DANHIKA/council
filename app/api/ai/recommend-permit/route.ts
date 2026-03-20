import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOllamaContent } from "@/lib/ollama";
import { getRelevantScenarios } from "@/lib/ai-scenarios";

export async function POST(req: NextRequest) {
    try {
        const { description } = await req.json();

        if (!description) {
            return NextResponse.json({ error: "Description is required" }, { status: 400 });
        }

        const permitTypes = await prisma.permitType.findMany({
            select: { name: true, description: true }
        }) as { name: string; description: string | null }[];

        const relevantScenarios = getRelevantScenarios(description);
        const scenarioText = relevantScenarios
            .map(s => `User described: "${s.query}"\nCorrect permit: {"recommendation": "${s.recommendation}", "explanation": "${s.explanation}"}`)
            .join("\n\n");

        const permitList = permitTypes.map(pt => `- ${pt.name}: ${pt.description}`).join("\n");

        // Simplified prompt for smaller models
        const prompt = `Permit types: ${permitList}

Examples:
${scenarioText}

User wants: "${description}"

What permit is needed? Reply with just the permit name.`;

        const responseText = await generateOllamaContent(prompt);
        console.log("Ollama recommend response:", responseText);

        try {
            // Try to find a matching permit type in the response
            const normalizedResponse = responseText.toLowerCase();
            const foundPermit = permitTypes.find(pt =>
                normalizedResponse.includes(pt.name.toLowerCase())
            );

            if (foundPermit) {
                return NextResponse.json({
                    recommendation: foundPermit.name,
                    explanation: "Recommended based on your project description."
                });
            }

            // Fallback: check if any permit name appears in the response
            for (const pt of permitTypes) {
                if (normalizedResponse.includes(pt.name.toLowerCase())) {
                    return NextResponse.json({
                        recommendation: pt.name,
                        explanation: "Matched based on your project description."
                    });
                }
            }

            throw new Error("No matching permit found in AI response");
        } catch (parseError) {
            console.error("Failed to parse AI response:", responseText, parseError);
            return NextResponse.json({
                recommendation: "Manual Selection Required",
                explanation: "Could not automatically determine the permit type. Please select one from the list above."
            });
        }
    } catch (error: any) {
        console.error("Permit recommendation error:", error);

        const isServiceError = error?.message?.includes("Ollama") || error?.message?.includes("connection");
        if (isServiceError) {
            return NextResponse.json({
                recommendation: "AI Unavailable",
                explanation: "The AI service is temporarily unavailable. Please wait a moment and try again, or select a permit type manually."
            }, { status: 503 });
        }

        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
