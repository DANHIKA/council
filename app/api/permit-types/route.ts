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

        // Map to match the PermitType interface expected by the frontend
        const mappedPermitTypes = permitTypes.map(pt => ({
            id: pt.id,
            code: pt.code,
            name: pt.name,
            description: pt.description,
            fee: Number(pt.applicationFee), // Use applicationFee as the fee
            currency: pt.currency,
            requirements: (pt as any).requirements || [],
        }));

        return NextResponse.json({ permitTypes: mappedPermitTypes });
    } catch (error) {
        console.error("List permit types error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
