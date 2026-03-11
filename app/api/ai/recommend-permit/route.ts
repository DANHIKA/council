import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOllamaContent, compactContext } from "@/lib/ollama";

import { getRelevantScenarios } from "@/lib/ai-scenarios";

export async function POST(req: NextRequest) {
    try {
        const { description } = await req.json();

        if (!description) {
            return NextResponse.json({ error: "Description is required" }, { status: 400 });
        }

        const permitTypes = await prisma.permitType.findMany({
            select: { name: true, description: true }
        });

        const relevantScenarios = getRelevantScenarios(description);
        const scenarioText = relevantScenarios
            .map(s => `User: "${s.query}"\nResponse: {"recommendation": "${s.recommendation}", "explanation": "${s.explanation}"}`)
            .join("\n\n");

        // Compact the permit list to save tokens and avoid confusing the model
        const compactPermitList = compactContext(permitTypes, (pt) => `${pt.name} (${pt.description})`);

        const prompt = `### Instruction ###
You are a Council Permit Expert. Based on the User Query, select the MOST relevant permit from the list below.
You MUST respond with ONLY a valid JSON object.

### Available Permits ###
${compactPermitList}

### Examples ###
${scenarioText}

### Current Task ###
User: "${description}"
Response:`;

        const responseText = await generateOllamaContent(prompt);
        console.log("Ollama Raw Response:", responseText);
        
        try {
            // Find the JSON block more aggressively
            const match = responseText.match(/\{[\s\S]*\}/);
            if (match) {
                const recommendation = JSON.parse(match[0]);
                // Validate that the recommendation actually exists in our list
                const exists = permitTypes.some(pt => 
                    pt.name.toLowerCase() === recommendation.recommendation.toLowerCase()
                );
                
                if (exists) {
                    return NextResponse.json(recommendation);
                }
            }

            // Fallback: Heuristic search if JSON fails or model hallucinates a name
            const normalizedResponse = responseText.toLowerCase();
            const foundPermit = permitTypes.find(pt => 
                normalizedResponse.includes(pt.name.toLowerCase())
            );

            if (foundPermit) {
                return NextResponse.json({
                    recommendation: foundPermit.name,
                    explanation: "Found a matching permit in the response text."
                });
            }

            throw new Error("No JSON or matching permit name found");
        } catch (parseError) {
            console.error("Failed to parse AI response:", responseText, parseError);
            return NextResponse.json({ 
                recommendation: "Manual Selection Required", 
                explanation: "AI provided a detailed answer but failed to format it. Please choose from the list above." 
            });
        }
    } catch (error: any) {
        console.error("Permit recommendation error:", error);
        
        // Handle specific API quota errors
        const isQuotaError = error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("quota");
        if (isQuotaError) {
            return NextResponse.json({ 
                recommendation: "AI is currently busy", 
                explanation: "The AI service is experiencing high traffic. Please wait a few seconds and try again, or select a permit type manually from the list above." 
            }, { status: 429 });
        }

        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
