import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Intent patterns ────────────────────────────────────────────────────────────
const I = {
    greeting:         /^(hi|hello|hey|good\s*(morning|afternoon|evening))[\s!?.]*$/i,
    overview:         /\b(overview|summary|status update|dashboard|how.*(things|everything)|give me a|whats going on)\b/i,
    pending_signoff:  /\b(pending sign.?off|needs? (admin |final )?sign.?off|awaiting (admin|approval)|final approval)\b/i,
    count_submitted:  /\b(how many|count|total|number of).{0,20}(submitted|new application)\b/i,
    count_review:     /\b(how many|count|total).{0,20}(under review|being reviewed|in review|in the queue)\b/i,
    count_approved:   /\b(how many|count|total).{0,20}(approved|passed|successful)\b/i,
    count_rejected:   /\b(how many|count|total).{0,20}(rejected|denied|failed)\b/i,
    count_correction: /\b(how many|count|total).{0,20}(correction|correcting|resubmit)\b/i,
    count_all:        /\b(how many|count|total|all) applications?\b/i,
    officer_workload: /\b(officer|who).{0,20}(most|review|assigned|workload|busiest|stats)\b|\b(workload|busiest officer)\b/i,
    approval_rate:    /\b(approval rate|pass rate|success rate|percentage.{0,10}approved)\b/i,
    overdue:          /\b(overdue|waiting too long|old application|stale|more than \d+ day|haven.?t been reviewed)\b/i,
    by_type:          /\b(by (permit )?type|per type|breakdown|building|business licen|event permit|environmental|road excavation|food handling|outdoor advertising|land use)\b/i,
    my_stats:         /\b(my (reviews?|applications?|decisions?|stats?|work|cases?)|what (have )?i (reviewed|done|processed|approved|rejected))\b/i,
    today:            /\btoday\b/i,
    this_week:        /\b(this week|last 7 days?|past week|recent submissions?)\b/i,
    this_month:       /\b(this month|last 30 days?|past month)\b/i,
};

function detectIntent(msg: string): string | null {
    for (const [key, re] of Object.entries(I)) {
        if (re.test(msg)) return key;
    }
    return null;
}

// ── Query handlers ─────────────────────────────────────────────────────────────
async function handleQuery(msg: string, userId: string, role: string): Promise<string> {
    const now = new Date();
    const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo     = new Date(now.getTime() - 7  * 86400000);
    const monthAgo    = new Date(now.getTime() - 30 * 86400000);

    const intent = detectIntent(msg);

    // ── greeting ────────────────────────────────────────────────────────────
    if (intent === "greeting") {
        const [submitted, review, pendingApproval, total] = await Promise.all([
            prisma.permitApplication.count({ where: { status: "SUBMITTED" } }),
            prisma.permitApplication.count({ where: { status: "UNDER_REVIEW" } }),
            prisma.permitApplication.count({ where: { status: "PENDING_APPROVAL" } }),
            prisma.permitApplication.count(),
        ]);
        const adminNote = role === "ADMIN" && pendingApproval > 0
            ? `\n\n⚠️ **${pendingApproval}** application${pendingApproval !== 1 ? "s" : ""} pending your sign-off.`
            : "";
        return `Hi! Here's your current snapshot:\n\n📋 **${total}** total · ⏳ **${submitted}** submitted · 🔍 **${review}** under review${role === "ADMIN" ? ` · 🟣 **${pendingApproval}** pending sign-off` : ""}${adminNote}\n\nWhat would you like to dig into?`;
    }

    // ── overview ────────────────────────────────────────────────────────────
    if (intent === "overview") {
        const [submitted, review, pendingApproval, approved, rejected, corrections, total, weekNew] = await Promise.all([
            prisma.permitApplication.count({ where: { status: "SUBMITTED" } }),
            prisma.permitApplication.count({ where: { status: "UNDER_REVIEW" } }),
            prisma.permitApplication.count({ where: { status: "PENDING_APPROVAL" } }),
            prisma.permitApplication.count({ where: { status: "APPROVED" } }),
            prisma.permitApplication.count({ where: { status: "REJECTED" } }),
            prisma.permitApplication.count({ where: { status: "REQUIRES_CORRECTION" } }),
            prisma.permitApplication.count(),
            prisma.permitApplication.count({ where: { createdAt: { gte: weekAgo } } }),
        ]);
        return `**Application Overview**\n\n| Status | Count |\n|---|---|\n| 📥 Submitted | ${submitted} |\n| 🔍 Under Review | ${review} |\n| 🟣 Pending Sign-off | ${pendingApproval} |\n| ✅ Approved | ${approved} |\n| ❌ Rejected | ${rejected} |\n| 🔄 Requires Correction | ${corrections} |\n| **Total** | **${total}** |\n\n📈 **${weekNew}** new submission${weekNew !== 1 ? "s" : ""} in the last 7 days.`;
    }

    // ── pending sign-off ────────────────────────────────────────────────────
    if (intent === "pending_signoff") {
        const apps = await prisma.permitApplication.findMany({
            where: { status: "PENDING_APPROVAL" },
            include: {
                applicant: { select: { name: true } },
                officer:   { select: { name: true } },
            },
            orderBy: { updatedAt: "asc" },
            take: 10,
        });
        if (apps.length === 0) return "✅ No applications are currently pending sign-off.";
        const lines = apps.map(a =>
            `- **${a.permitType}** — *${a.applicant.name || "Unknown"}* · recommended by ${a.officer?.name || "officer"}`
        );
        return `**Pending Sign-off (${apps.length})**\n\n${lines.join("\n")}\n\nGo to the Admin Dashboard to sign off on these.`;
    }

    // ── individual status counts ─────────────────────────────────────────────
    if (intent === "count_submitted") {
        const n = await prisma.permitApplication.count({ where: { status: "SUBMITTED" } });
        return `**${n}** application${n !== 1 ? "s" : ""} submitted and waiting to be picked up for review.`;
    }
    if (intent === "count_review") {
        const [review, pending] = await Promise.all([
            prisma.permitApplication.count({ where: { status: "UNDER_REVIEW" } }),
            prisma.permitApplication.count({ where: { status: "PENDING_APPROVAL" } }),
        ]);
        return `**${review}** under active review · **${pending}** pending admin sign-off.`;
    }
    if (intent === "count_approved") {
        const n = await prisma.permitApplication.count({ where: { status: "APPROVED" } });
        return `**${n}** application${n !== 1 ? "s" : ""} approved in total.`;
    }
    if (intent === "count_rejected") {
        const n = await prisma.permitApplication.count({ where: { status: "REJECTED" } });
        return `**${n}** application${n !== 1 ? "s" : ""} rejected in total.`;
    }
    if (intent === "count_correction") {
        const n = await prisma.permitApplication.count({ where: { status: "REQUIRES_CORRECTION" } });
        return `**${n}** application${n !== 1 ? "s" : ""} waiting for corrections from applicants.`;
    }
    if (intent === "count_all") {
        const [total, submitted, review, pendingApproval, approved, rejected, corrections] = await Promise.all([
            prisma.permitApplication.count(),
            prisma.permitApplication.count({ where: { status: "SUBMITTED" } }),
            prisma.permitApplication.count({ where: { status: "UNDER_REVIEW" } }),
            prisma.permitApplication.count({ where: { status: "PENDING_APPROVAL" } }),
            prisma.permitApplication.count({ where: { status: "APPROVED" } }),
            prisma.permitApplication.count({ where: { status: "REJECTED" } }),
            prisma.permitApplication.count({ where: { status: "REQUIRES_CORRECTION" } }),
        ]);
        return `**${total}** total applications:\n\n- 📥 Submitted: ${submitted}\n- 🔍 Under Review: ${review}\n- 🟣 Pending Sign-off: ${pendingApproval}\n- ✅ Approved: ${approved}\n- ❌ Rejected: ${rejected}\n- 🔄 Requires Correction: ${corrections}`;
    }

    // ── officer workload ────────────────────────────────────────────────────
    if (intent === "officer_workload") {
        const officers = await prisma.user.findMany({
            where: { role: { in: ["OFFICER", "ADMIN"] } },
            select: {
                name: true,
                reviews: {
                    where: { status: { in: ["UNDER_REVIEW", "PENDING_APPROVAL"] } },
                    select: { id: true },
                },
            },
        });
        if (officers.length === 0) return "No officers found.";
        const sorted = officers
            .map(o => ({ name: o.name || "Unknown", active: o.reviews.length }))
            .sort((a, b) => b.active - a.active);
        const lines = sorted.map(o =>
            `- **${o.name}**: ${o.active} active case${o.active !== 1 ? "s" : ""}`
        );
        return `**Officer Workload (active cases)**\n\n${lines.join("\n")}`;
    }

    // ── approval rate ───────────────────────────────────────────────────────
    if (intent === "approval_rate") {
        const [approved, rejected] = await Promise.all([
            prisma.permitApplication.count({ where: { status: "APPROVED" } }),
            prisma.permitApplication.count({ where: { status: "REJECTED" } }),
        ]);
        const decided = approved + rejected;
        if (decided === 0) return "No final decisions have been made yet.";
        const rate = Math.round((approved / decided) * 100);
        return `**Approval Rate: ${rate}%**\n\n✅ Approved: **${approved}**\n❌ Rejected: **${rejected}**\n📊 Total decided: **${decided}**`;
    }

    // ── overdue ─────────────────────────────────────────────────────────────
    if (intent === "overdue") {
        const overdue = await prisma.permitApplication.findMany({
            where: {
                status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
                createdAt: { lte: weekAgo },
            },
            select: {
                permitType: true,
                createdAt: true,
                applicant: { select: { name: true } },
            },
            orderBy: { createdAt: "asc" },
            take: 10,
        });
        if (overdue.length === 0) return "✅ No applications have been waiting more than 7 days without a decision.";
        const lines = overdue.map(a => {
            const days = Math.floor((now.getTime() - new Date(a.createdAt).getTime()) / 86400000);
            return `- **${a.permitType}** — ${a.applicant.name || "Unknown"} *(${days} days)*`;
        });
        return `**Overdue Applications (>7 days, ${overdue.length} found)**\n\n${lines.join("\n")}`;
    }

    // ── by permit type ───────────────────────────────────────────────────────
    if (intent === "by_type") {
        const counts = await prisma.permitApplication.groupBy({
            by: ["permitType"],
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
        });
        if (counts.length === 0) return "No applications found.";
        const lines = counts.map(c => `- **${c.permitType}**: ${c._count.id}`);
        return `**Applications by Permit Type**\n\n${lines.join("\n")}`;
    }

    // ── my stats ─────────────────────────────────────────────────────────────
    if (intent === "my_stats") {
        const [active, totalDecided, monthDecided] = await Promise.all([
            prisma.permitApplication.count({
                where: { officerId: userId, status: { in: ["UNDER_REVIEW", "PENDING_APPROVAL"] } },
            }),
            prisma.permitApplication.count({
                where: { officerId: userId, status: { in: ["APPROVED", "REJECTED"] } },
            }),
            prisma.permitApplication.count({
                where: { officerId: userId, status: { in: ["APPROVED", "REJECTED"] }, updatedAt: { gte: monthAgo } },
            }),
        ]);
        return `**Your Stats**\n\n🔍 Active cases: **${active}**\n✅ Total decisions made: **${totalDecided}**\n📅 Decisions this month: **${monthDecided}**`;
    }

    // ── today ─────────────────────────────────────────────────────────────────
    if (intent === "today") {
        const [count, apps] = await Promise.all([
            prisma.permitApplication.count({ where: { createdAt: { gte: todayStart } } }),
            prisma.permitApplication.findMany({
                where: { createdAt: { gte: todayStart } },
                select: { permitType: true, applicant: { select: { name: true } } },
                orderBy: { createdAt: "desc" },
                take: 5,
            }),
        ]);
        if (count === 0) return "No applications submitted today yet.";
        const lines = apps.map(a => `- **${a.permitType}** — ${a.applicant.name || "Unknown"}`);
        const extra = count > 5 ? `\n*...and ${count - 5} more*` : "";
        return `**${count}** application${count !== 1 ? "s" : ""} submitted today:\n\n${lines.join("\n")}${extra}`;
    }

    // ── this week ────────────────────────────────────────────────────────────
    if (intent === "this_week") {
        const [count, byType] = await Promise.all([
            prisma.permitApplication.count({ where: { createdAt: { gte: weekAgo } } }),
            prisma.permitApplication.groupBy({
                by: ["permitType"],
                where: { createdAt: { gte: weekAgo } },
                _count: { id: true },
                orderBy: { _count: { id: "desc" } },
            }),
        ]);
        if (count === 0) return "No applications submitted in the last 7 days.";
        const lines = byType.map(t => `- ${t.permitType}: ${t._count.id}`);
        return `**${count}** application${count !== 1 ? "s" : ""} submitted this week:\n\n${lines.join("\n")}`;
    }

    // ── this month ───────────────────────────────────────────────────────────
    if (intent === "this_month") {
        const [count, approved, rejected] = await Promise.all([
            prisma.permitApplication.count({ where: { createdAt: { gte: monthAgo } } }),
            prisma.permitApplication.count({ where: { status: "APPROVED", updatedAt: { gte: monthAgo } } }),
            prisma.permitApplication.count({ where: { status: "REJECTED", updatedAt: { gte: monthAgo } } }),
        ]);
        return `**This Month (last 30 days)**\n\n📥 New submissions: **${count}**\n✅ Approved: **${approved}**\n❌ Rejected: **${rejected}**`;
    }

    // ── fallback ─────────────────────────────────────────────────────────────
    return `I can answer questions about applications. Try:\n\n- *"Give me an overview"*\n- *"How many applications are pending?"*\n- *"This week's submissions"*\n- *"What's the approval rate?"*\n- *"Officer workload"*\n- *"Any overdue applications?"*\n- *"My stats"*\n- *"Applications by type"*`;
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const userRole = (session.user as any).role as string;
        if (userRole !== "OFFICER" && userRole !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { messages } = await req.json();
        const lastMessage: string =
            messages?.filter((m: any) => m.role === "user").pop()?.content?.trim() || "";

        if (!lastMessage) return NextResponse.json({ response: "What would you like to know?" });

        const response = await handleQuery(lastMessage, session.user.id, userRole);
        return NextResponse.json({ response });
    } catch (error) {
        console.error("Staff chat error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
