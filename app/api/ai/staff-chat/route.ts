import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generate, chat } from "@/lib/ai-provider";
import type { Message } from "@/lib/ai-provider";

// ── Intent classification ─────────────────────────────────────────────────────

const INTENTS = [
  "greeting", "overview", "pending_signoff",
  "count_submitted", "count_review", "count_approved", "count_rejected", "count_correction", "count_all",
  "officer_workload", "approval_rate", "overdue", "by_type", "my_stats",
  "today", "this_week", "this_month",
] as const;

type Intent = typeof INTENTS[number] | "unknown";

async function classifyIntent(msg: string): Promise<Intent> {
  const prompt = `Classify this staff message into exactly one intent. Reply with ONLY the intent name.

Intents:
greeting       – hello, hi, how are you, social
overview       – general status, dashboard, what's going on
pending_signoff – applications needing final admin approval
count_submitted – how many submitted / new
count_review   – how many under review
count_approved – how many approved
count_rejected – how many rejected
count_correction – how many need correction
count_all      – total application count
officer_workload – officer assignments, busiest officer
approval_rate  – pass rate, success percentage
overdue        – waiting too long, stale, haven't been reviewed
by_type        – breakdown by permit type
my_stats       – user's own cases / decisions
today          – today's activity
this_week      – this week / last 7 days
this_month     – this month / last 30 days
unknown        – anything not listed above

Message: "${msg}"`;

  const raw = (await generate(prompt, 15)).trim().toLowerCase();
  return (INTENTS as readonly string[]).includes(raw) ? (raw as Intent) : "unknown";
}

// ── Data fetchers (return raw data, AI writes the words) ──────────────────────

async function fetchData(intent: Intent, userId: string, role: string): Promise<Record<string, any> | null> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo    = new Date(now.getTime() - 7  * 86400000);
  const monthAgo   = new Date(now.getTime() - 30 * 86400000);

  switch (intent) {
    case "greeting":
    case "overview": {
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
      return { submitted, review, pendingApproval, approved, rejected, corrections, total, newThisWeek: weekNew, userRole: role };
    }

    case "pending_signoff": {
      const apps = await prisma.permitApplication.findMany({
        where: { status: "PENDING_APPROVAL" },
        include: { applicant: { select: { name: true } }, officer: { select: { name: true } } },
        orderBy: { updatedAt: "asc" },
        take: 10,
      });
      return { count: apps.length, applications: apps.map(a => ({ type: a.permitType, applicant: a.applicant.name, officer: a.officer?.name })) };
    }

    case "count_submitted": {
      const n = await prisma.permitApplication.count({ where: { status: "SUBMITTED" } });
      return { submitted: n };
    }

    case "count_review": {
      const [review, pending] = await Promise.all([
        prisma.permitApplication.count({ where: { status: "UNDER_REVIEW" } }),
        prisma.permitApplication.count({ where: { status: "PENDING_APPROVAL" } }),
      ]);
      return { underReview: review, pendingSignoff: pending };
    }

    case "count_approved": {
      const n = await prisma.permitApplication.count({ where: { status: "APPROVED" } });
      return { approved: n };
    }

    case "count_rejected": {
      const n = await prisma.permitApplication.count({ where: { status: "REJECTED" } });
      return { rejected: n };
    }

    case "count_correction": {
      const n = await prisma.permitApplication.count({ where: { status: "REQUIRES_CORRECTION" } });
      return { requiresCorrection: n };
    }

    case "count_all": {
      const [total, submitted, review, pendingApproval, approved, rejected, corrections] = await Promise.all([
        prisma.permitApplication.count(),
        prisma.permitApplication.count({ where: { status: "SUBMITTED" } }),
        prisma.permitApplication.count({ where: { status: "UNDER_REVIEW" } }),
        prisma.permitApplication.count({ where: { status: "PENDING_APPROVAL" } }),
        prisma.permitApplication.count({ where: { status: "APPROVED" } }),
        prisma.permitApplication.count({ where: { status: "REJECTED" } }),
        prisma.permitApplication.count({ where: { status: "REQUIRES_CORRECTION" } }),
      ]);
      return { total, submitted, review, pendingApproval, approved, rejected, corrections };
    }

    case "officer_workload": {
      const officers = await prisma.user.findMany({
        where: { role: { in: ["OFFICER", "ADMIN"] } },
        select: {
          name: true,
          reviews: { where: { status: { in: ["UNDER_REVIEW", "PENDING_APPROVAL"] } }, select: { id: true } },
        },
      });
      return {
        officers: officers
          .map(o => ({ name: o.name || "Unknown", activeCases: o.reviews.length }))
          .sort((a, b) => b.activeCases - a.activeCases),
      };
    }

    case "approval_rate": {
      const [approved, rejected] = await Promise.all([
        prisma.permitApplication.count({ where: { status: "APPROVED" } }),
        prisma.permitApplication.count({ where: { status: "REJECTED" } }),
      ]);
      const decided = approved + rejected;
      return { approved, rejected, decided, rate: decided > 0 ? Math.round((approved / decided) * 100) : null };
    }

    case "overdue": {
      const apps = await prisma.permitApplication.findMany({
        where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, createdAt: { lte: weekAgo } },
        select: { permitType: true, createdAt: true, applicant: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
        take: 10,
      });
      return {
        count: apps.length,
        applications: apps.map(a => ({
          type: a.permitType,
          applicant: a.applicant.name,
          daysWaiting: Math.floor((now.getTime() - new Date(a.createdAt).getTime()) / 86400000),
        })),
      };
    }

    case "by_type": {
      const counts = await prisma.permitApplication.groupBy({
        by: ["permitType"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      });
      return { byType: counts.map(c => ({ type: c.permitType, count: c._count.id })) };
    }

    case "my_stats": {
      const [active, totalDecided, monthDecided] = await Promise.all([
        prisma.permitApplication.count({ where: { officerId: userId, status: { in: ["UNDER_REVIEW", "PENDING_APPROVAL"] } } }),
        prisma.permitApplication.count({ where: { officerId: userId, status: { in: ["APPROVED", "REJECTED"] } } }),
        prisma.permitApplication.count({ where: { officerId: userId, status: { in: ["APPROVED", "REJECTED"] }, updatedAt: { gte: monthAgo } } }),
      ]);
      return { activeCases: active, totalDecisions: totalDecided, decisionsThisMonth: monthDecided };
    }

    case "today": {
      const [count, apps] = await Promise.all([
        prisma.permitApplication.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.permitApplication.findMany({
          where: { createdAt: { gte: todayStart } },
          select: { permitType: true, applicant: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);
      return { count, recent: apps.map(a => ({ type: a.permitType, applicant: a.applicant.name })) };
    }

    case "this_week": {
      const [count, byType] = await Promise.all([
        prisma.permitApplication.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.permitApplication.groupBy({
          by: ["permitType"],
          where: { createdAt: { gte: weekAgo } },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
        }),
      ]);
      return { count, byType: byType.map(t => ({ type: t.permitType, count: t._count.id })) };
    }

    case "this_month": {
      const [count, approved, rejected] = await Promise.all([
        prisma.permitApplication.count({ where: { createdAt: { gte: monthAgo } } }),
        prisma.permitApplication.count({ where: { status: "APPROVED", updatedAt: { gte: monthAgo } } }),
        prisma.permitApplication.count({ where: { status: "REJECTED", updatedAt: { gte: monthAgo } } }),
      ]);
      return { newSubmissions: count, approved, rejected };
    }

    default:
      return null;
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  `You are a friendly, conversational council permit management assistant for staff. ` +
  `When you have data, weave it into a natural reply — don't just dump numbers. ` +
  `Sound like a helpful colleague, not a dashboard. Keep it concise.`;

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

    // 1. Classify intent
    const intent = await classifyIntent(lastMessage);

    // 2. Fetch relevant data (if any)
    const data = await fetchData(intent, session.user.id, userRole);

    // 3. AI crafts the response, with data injected into context if available
    const systemWithData = data
      ? `${SYSTEM_PROMPT}\n\nCurrent data for this query:\n${JSON.stringify(data, null, 2)}`
      : SYSTEM_PROMPT;

    const response = await chat(
      [{ role: "system", content: systemWithData }, ...(messages as Message[])],
      200
    );

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Staff chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
