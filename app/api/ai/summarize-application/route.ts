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

        const prompt = `### INSTRUCTION ###
You are a Senior Council Planning Officer. Summarize the following permit application into a professional Briefing Note.
Focus on the CORE INTENT, the SCALE of the project, and any POTENTIAL CONCERNS.

### APPLICATION DATA ###
Applicant: ${application.applicant.name}
Permit Type: ${application.permitTypeRef?.name || application.permitType}
Project Description: "${application.description}"
Location: ${application.location}
Attached Documents: ${application.documents.length} files

### BRIEFING NOTE FORMAT ###
- **Project Scope:** (1 sentence on what they want to do)
- **Key Details:** (Location and scale)
- **Document Status:** (Assessment of the ${application.documents.length} files provided)
- **Officer Initial Assessment:** (Is this a standard or complex request?)

Briefing Note:`;

        const summary = await generateOllamaContent(prompt);

        return NextResponse.json({ summary });
    } catch (error: any) {
        console.error("Auto-summary error:", error);
        
        // Handle specific API quota errors
        const isQuotaError = error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("quota");
        if (isQuotaError) {
            return NextResponse.json({ 
                error: "AI is currently busy", 
                summary: "AI summary is temporarily unavailable due to high demand. Please try again in a few seconds." 
            }, { status: 429 });
        }

        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
