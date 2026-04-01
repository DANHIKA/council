import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generate } from "@/lib/ai-provider";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user as any).role === "APPLICANT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { applicationId, provider } = await req.json();

    if (!applicationId) {
      return NextResponse.json({ error: "Application ID is required" }, { status: 400 });
    }

    const application = await prisma.permitApplication.findUnique({
      where: { id: applicationId },
      include: { applicant: true, permitTypeRef: true, documents: true },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const permitName = application.permitTypeRef?.name ?? application.permitType;
    const docSummary = application.documents.length > 0
      ? application.documents.map(d => d.name).join(", ")
      : "no documents uploaded";

    const prompt = `You are a council permit officer reviewing an application. Write a brief, natural briefing note (3–4 sentences) as if you were handing this to a colleague before they open the file. Be informative but conversational — mention what the applicant wants to do, where, and whether the submission looks complete. Flag anything worth paying attention to.

Application details:
- Applicant: ${application.applicant.name}
- Permit: ${permitName}
- Description: ${application.description}
- Location: ${application.location}
- Status: ${application.status}
- Documents: ${docSummary}`;

    const summary = await generate(prompt, 300, provider);

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error("Auto-summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
