import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOllamaContent } from "@/lib/ollama";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session || (session.user as any).role === "APPLICANT") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { applicationId } = await req.json();

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

        const summary = await generateOllamaContent(prompt);

        return NextResponse.json({ summary });
    } catch (error: any) {
        console.error("Auto-summary error:", error);

        const isServiceError = error?.message?.includes("Ollama") || error?.message?.includes("connection");
        if (isServiceError) {
            return NextResponse.json({
                error: "AI is currently unavailable",
                summary: "AI summary is temporarily unavailable. Please try again in a moment."
            }, { status: 503 });
        }

        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
