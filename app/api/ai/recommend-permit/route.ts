import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateContent } from "@/lib/gemini";

export async function POST(req: NextRequest) {
    try {
        const { description } = await req.json();

        if (!description) {
            return NextResponse.json({ error: "Description is required" }, { status: 400 });
        }

        const permitTypes = await prisma.permitType.findMany({
            select: { id: true, name: true, description: true }
        });

        const permitList = permitTypes.map(pt => `- ${pt.name}: ${pt.description}`).join('\n');

        const prompt = `
            You are a council permit assistant. A citizen wants to do the following: "${description}".
            Based on the following list of available permit types, recommend the most suitable one(s).
            If none match, say "No specific permit found, please contact the council".
            Provide a short explanation for your recommendation.
            
            Available Permit Types:
            ${permitList}
            
            Return the response in JSON format like this:
            {
                "recommendation": "Permit Name",
                "explanation": "Why this permit matches"
            }
        `;

        const responseText = await generateContent(prompt);
        // Extract JSON from responseText (Gemini might wrap it in markdown code blocks)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const recommendation = jsonMatch ? JSON.parse(jsonMatch[0]) : { recommendation: "Error parsing recommendation", explanation: "" };

        return NextResponse.json(recommendation);
    } catch (error) {
        console.error("Permit recommendation error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
