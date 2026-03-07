import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const includeRequirements = searchParams.get("includeRequirements") === "true";

        const permitTypes = await prisma.permitType.findMany({
            orderBy: { name: "asc" },
            ...(includeRequirements && {
                include: {
                    requirements: {
                        orderBy: { sortOrder: "asc" },
                    },
                },
            }),
        });

        return NextResponse.json({ permitTypes });
    } catch (error) {
        console.error("List permit types error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
