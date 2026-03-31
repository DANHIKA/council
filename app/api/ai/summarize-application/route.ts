import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generate, getProvider } from "@/lib/ai-provider";
import { auth } from "@/lib/auth";

type AIProvider = "groq" | "gemini" | "ollama";

export async function POST(req: NextRequest) {
    let provider: AIProvider | undefined;
    
    try {
        const session = await auth();
        if (!session || (session.user as any).role === "APPLICANT") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        provider = body.provider as AIProvider | undefined;
        const { applicationId } = body;

        if (!applicationId) {
            return NextResponse.json({ error: "Application ID is required" }, { status: 400 });
        }

        const application = await prisma.permitApplication.findUnique({
            where: { id: applicationId },
            include: {
                applicant: true,
                permitTypeRef: true,
                documents: true,
            }
        });

        if (!application) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }

        const docList = application.documents.length > 0
            ? application.documents.map(d => `- ${d.name} (${d.fileType})`).join("\n")
            : "No documents uploaded.";

        // Simplified prompt for smaller models
        const prompt = `Write a brief summary of this permit application.

Applicant: ${application.applicant.name}
Permit Type: ${application.permitTypeRef?.name || application.permitType}
Project: ${application.description}
Location: ${application.location}
Documents: ${application.documents.length} files submitted

Provide a 4-line summary with:
1. What the applicant wants to do
2. Where it's located
3. What documents were provided
4. Any initial observations

Summary:`;

        const summary = await generate(prompt, 512, provider);

        return NextResponse.json({ summary });
    } catch (error: any) {
        console.error("Auto-summary error:", error);

        const providerForError = provider || getProvider();
        const isServiceError = error?.message?.includes("API") || error?.message?.includes("connection") || error?.message?.includes(providerForError);
        if (isServiceError) {
            return NextResponse.json({
                error: "AI is currently unavailable",
                summary: "AI summary is temporarily unavailable. Please try again in a moment."
            }, { status: 503 });
        }

        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
