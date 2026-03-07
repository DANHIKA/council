import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateContent } from "@/lib/gemini";
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

        const prompt = `
            Summarize this council permit application for an officer in 2-3 sentences.
            Applicant: ${application.applicant.name}
            Permit Type: ${application.permitTypeRef?.name || application.permitType}
            Description: ${application.description}
            Location: ${application.location}
            Number of documents: ${application.documents.length}
            
            Focus on the key intent and anything that might require special attention.
        `;

        const summary = await generateContent(prompt);

        return NextResponse.json({ summary });
    } catch (error) {
        console.error("Auto-summary error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
