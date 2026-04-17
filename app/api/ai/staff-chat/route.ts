import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generate, chat } from "@/lib/ai-provider";
import type { Message } from "@/lib/ai-provider";
import type { ProposedAction, ActionType } from "@/components/chat/action-card";

// ── Intent classification ─────────────────────────────────────────────────────

const INTENTS = [
  "greeting", "overview", "pending_signoff",
  "count_submitted", "count_review", "count_approved", "count_rejected", "count_correction", "count_all",
  "officer_workload", "approval_rate", "overdue", "by_type", "my_stats",
  "today", "this_week", "this_month",
] as const;

const VISUALIZATION_INTENTS = [
  "chart_overview", "chart_by_type", "chart_status", "chart_trend",
  "table_pending", "table_overdue", "table_officers", "table_recent",
  "stats_summary",
] as const;

const ACTION_INTENTS = [
  "officer_approve", "officer_reject", "officer_corrections",
  "officer_assign", "admin_signoff", "admin_reject_final", "summarize",
] as const;

type Intent = typeof INTENTS[number] | "unknown";
type VisualizationIntent = typeof VISUALIZATION_INTENTS[number] | null;
type ActionIntent = typeof ACTION_INTENTS[number] | null;

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

async function classifyVisualization(msg: string): Promise<VisualizationIntent> {
  const prompt = `Does this message request a chart, table, or statistics visualization? Reply with ONLY the intent name or "none".

Visualization intents:
chart_overview   – show chart/dashboard/graph of overall status
chart_by_type    – bar/pie chart of permit types breakdown
chart_status     – pie chart of application status distribution
chart_trend      – line chart of applications over time
table_pending    – table of applications pending approval
table_overdue    – table of overdue applications
table_officers   – table of officer workloads
table_recent     – table of recent applications
stats_summary    – summary statistics cards

Message: "${msg}"`;

  const raw = (await generate(prompt, 20)).trim().toLowerCase();
  return (VISUALIZATION_INTENTS as readonly string[]).includes(raw) ? (raw as VisualizationIntent) : null;
}

async function classifyAction(msg: string): Promise<ActionIntent> {
  const prompt = `Does this message request an action on a specific application? Reply with ONLY the action name or "none".

Actions:
officer_approve     – recommend approval, approve this application, mark as approved
officer_reject      – reject, deny, decline this application
officer_corrections – request corrections, send back, needs changes
officer_assign      – assign to me, I'll handle this, take this case
admin_signoff       – final approval, sign off, grant permit, final sign-off approve
admin_reject_final  – final rejection, sign off reject
summarize           – summarize, brief me on, give me a summary of, what's this application about

Message: "${msg}"`;

  const raw = (await generate(prompt, 15)).trim().toLowerCase();
  return (ACTION_INTENTS as readonly string[]).includes(raw) ? (raw as ActionIntent) : null;
}

// ── Application resolver ──────────────────────────────────────────────────────

type StatusFilter = { status?: any };

function statusFilterForAction(intent: ActionIntent): StatusFilter {
  switch (intent) {
    case "officer_approve":
    case "officer_reject":
    case "officer_corrections":
    case "officer_assign":
      return { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } };
    case "admin_signoff":
    case "admin_reject_final":
      return { status: "PENDING_APPROVAL" };
    default:
      return {};
  }
}

async function resolveApplication(
  msg: string,
  intent: ActionIntent
): Promise<{ applicationId: string; ref: string } | null> {
  // Use AI to extract the identifying term from the message
  const extractPrompt = `Extract the main identifier used to reference an application from this message. It may be a person's name, a permit type, or an application ID. Reply with ONLY the extracted term, or "none".

Message: "${msg}"`;

  const identifier = (await generate(extractPrompt, 20)).trim().toLowerCase();
  if (!identifier || identifier === "none") return null;

  const filter = statusFilterForAction(intent);

  const select = {
    id: true,
    permitType: true,
    applicant: { select: { name: true } },
  };

  // Try by applicant name
  const byName = await prisma.permitApplication.findFirst({
    where: { applicant: { name: { contains: identifier, mode: "insensitive" } }, ...filter },
    select,
    orderBy: { updatedAt: "desc" },
  });
  if (byName) return { applicationId: byName.id, ref: `${byName.permitType} — ${byName.applicant.name}` };

  // Try by permit type
  const byType = await prisma.permitApplication.findFirst({
    where: { permitType: { contains: identifier, mode: "insensitive" }, ...filter },
    select,
    orderBy: { updatedAt: "desc" },
  });
  if (byType) return { applicationId: byType.id, ref: `${byType.permitType} — ${byType.applicant.name}` };

  // Try by ID fragment
  const byId = await prisma.permitApplication.findFirst({
    where: { id: { contains: identifier }, ...filter },
    select,
    orderBy: { updatedAt: "desc" },
  });
  if (byId) return { applicationId: byId.id, ref: `${byId.permitType} — ${byId.applicant.name}` };

  return null;
}

function buildActionProposal(intent: ActionIntent, resolved: { applicationId: string; ref: string }): ProposedAction {
  const map: Record<NonNullable<ActionIntent>, { type: ActionType; label: string; requiresNotes: boolean }> = {
    officer_approve:     { type: "officer_approve",     label: "Recommend Approval",          requiresNotes: true },
    officer_reject:      { type: "officer_reject",      label: "Reject Application",           requiresNotes: true },
    officer_corrections: { type: "officer_corrections", label: "Request Corrections",          requiresNotes: true },
    officer_assign:      { type: "officer_assign",      label: "Assign to Me",                 requiresNotes: false },
    admin_signoff:       { type: "admin_signoff",       label: "Final Approval (Sign-off)",    requiresNotes: false },
    admin_reject_final:  { type: "admin_reject_final",  label: "Final Rejection (Sign-off)",   requiresNotes: true },
    summarize:           { type: "summarize",            label: "Summarize Application",        requiresNotes: false },
  };

  const info = map[intent!];
  return {
    type: info.type,
    label: info.label,
    description: resolved.ref,
    applicationId: resolved.applicationId,
    requiresNotes: info.requiresNotes,
  };
}

// ── Visualization data fetchers ───────────────────────────────────────────────

async function fetchVisualizationData(intent: VisualizationIntent): Promise<any> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  switch (intent) {
    case "chart_overview": {
      const [submitted, review, pendingApproval, approved, rejected, corrections] = await Promise.all([
        prisma.permitApplication.count({ where: { status: "SUBMITTED" } }),
        prisma.permitApplication.count({ where: { status: "UNDER_REVIEW" } }),
        prisma.permitApplication.count({ where: { status: "PENDING_APPROVAL" } }),
        prisma.permitApplication.count({ where: { status: "APPROVED" } }),
        prisma.permitApplication.count({ where: { status: "REJECTED" } }),
        prisma.permitApplication.count({ where: { status: "REQUIRES_CORRECTION" } }),
      ]);
      return {
        type: "stats",
        stats: [
          { label: "Total Applications", value: submitted + review + pendingApproval + approved + rejected + corrections },
          { label: "Approved", value: approved, trend: "+12% this month" },
          { label: "Pending", value: submitted + review + pendingApproval, trend: "5 need attention" },
          { label: "Rejected", value: rejected, trend: "-3% this month" },
        ],
      };
    }

    case "chart_by_type": {
      const counts = await prisma.permitApplication.groupBy({
        by: ["permitType"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      });
      return {
        type: "chart",
        chart: {
          title: "Applications by Permit Type",
          type: "horizontalBar" as const,
          data: counts.map((c) => ({ name: c.permitType || "Unknown", value: c._count.id })),
        },
      };
    }

    case "chart_status": {
      const [submitted, review, pendingApproval, approved, rejected, corrections] = await Promise.all([
        prisma.permitApplication.count({ where: { status: "SUBMITTED" } }),
        prisma.permitApplication.count({ where: { status: "UNDER_REVIEW" } }),
        prisma.permitApplication.count({ where: { status: "PENDING_APPROVAL" } }),
        prisma.permitApplication.count({ where: { status: "APPROVED" } }),
        prisma.permitApplication.count({ where: { status: "REJECTED" } }),
        prisma.permitApplication.count({ where: { status: "REQUIRES_CORRECTION" } }),
      ]);
      const data = [
        { name: "Submitted", value: submitted },
        { name: "Under Review", value: review },
        { name: "Pending Approval", value: pendingApproval },
        { name: "Approved", value: approved },
        { name: "Rejected", value: rejected },
        { name: "Requires Correction", value: corrections },
      ].filter((d) => d.value > 0);
      return { type: "chart", chart: { title: "Application Status Breakdown", type: "pie" as const, data } };
    }

    case "chart_trend": {
      const last6Months = [];
      for (let i = 5; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const count = await prisma.permitApplication.count({
          where: { createdAt: { gte: start, lte: end } },
        });
        last6Months.push({ name: start.toLocaleDateString("en-US", { month: "short" }), value: count });
      }
      return { type: "chart", chart: { title: "Application Trends (Last 6 Months)", type: "line" as const, data: last6Months } };
    }

    case "table_pending": {
      const apps = await prisma.permitApplication.findMany({
        where: { status: "PENDING_APPROVAL" },
        include: { applicant: { select: { name: true } }, officer: { select: { name: true } } },
        orderBy: { updatedAt: "asc" },
        take: 20,
      });
      return {
        type: "table",
        table: {
          title: "Applications Pending Approval",
          columns: [
            { key: "type", header: "Permit Type" },
            { key: "applicant", header: "Applicant" },
            { key: "officer", header: "Officer" },
            { key: "status", header: "Status", type: "badge" as const },
          ],
          data: apps.map((a) => ({
            type: a.permitType,
            applicant: a.applicant.name,
            officer: a.officer?.name || "Unassigned",
            status: a.status,
          })),
        },
      };
    }

    case "table_overdue": {
      const apps = await prisma.permitApplication.findMany({
        where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, createdAt: { lte: weekAgo } },
        select: { permitType: true, createdAt: true, applicant: { select: { name: true } }, status: true },
        orderBy: { createdAt: "asc" },
        take: 20,
      });
      return {
        type: "table",
        table: {
          title: "Overdue Applications",
          columns: [
            { key: "type", header: "Permit Type" },
            { key: "applicant", header: "Applicant" },
            { key: "status", header: "Status", type: "badge" as const },
            { key: "daysWaiting", header: "Days Waiting", type: "number" as const },
          ],
          data: apps.map((a) => ({
            type: a.permitType,
            applicant: a.applicant.name,
            status: a.status,
            daysWaiting: Math.floor((now.getTime() - new Date(a.createdAt).getTime()) / 86400000),
          })),
        },
      };
    }

    case "table_officers": {
      const officers = await prisma.user.findMany({
        where: { role: { in: ["OFFICER", "ADMIN"] } },
        select: {
          name: true,
          reviews: { where: { status: { in: ["UNDER_REVIEW", "PENDING_APPROVAL"] } }, select: { id: true } },
        },
      });
      return {
        type: "table",
        table: {
          title: "Officer Workload",
          columns: [
            { key: "name", header: "Officer" },
            { key: "activeCases", header: "Active Cases", type: "number" as const },
          ],
          data: officers
            .map((o) => ({ name: o.name || "Unknown", activeCases: o.reviews.length }))
            .sort((a, b) => b.activeCases - a.activeCases),
        },
      };
    }

    case "table_recent": {
      const apps = await prisma.permitApplication.findMany({
        take: 15,
        orderBy: { createdAt: "desc" },
        include: { applicant: { select: { name: true } } },
      });
      return {
        type: "table",
        table: {
          title: "Recent Applications",
          columns: [
            { key: "type", header: "Permit Type" },
            { key: "applicant", header: "Applicant" },
            { key: "status", header: "Status", type: "badge" as const },
            { key: "createdAt", header: "Date", type: "date" as const },
          ],
          data: apps.map((a) => ({
            type: a.permitType,
            applicant: a.applicant.name,
            status: a.status,
            createdAt: a.createdAt.toISOString(),
          })),
        },
      };
    }

    case "stats_summary": {
      const [submitted, review, pendingApproval, approved, rejected, corrections, total] = await Promise.all([
        prisma.permitApplication.count({ where: { status: "SUBMITTED" } }),
        prisma.permitApplication.count({ where: { status: "UNDER_REVIEW" } }),
        prisma.permitApplication.count({ where: { status: "PENDING_APPROVAL" } }),
        prisma.permitApplication.count({ where: { status: "APPROVED" } }),
        prisma.permitApplication.count({ where: { status: "REJECTED" } }),
        prisma.permitApplication.count({ where: { status: "REQUIRES_CORRECTION" } }),
        prisma.permitApplication.count(),
      ]);
      const decided = approved + rejected;
      const rate = decided > 0 ? Math.round((approved / decided) * 100) : 0;
      return {
        type: "stats",
        stats: [
          { label: "Total Applications", value: total },
          { label: "Approval Rate", value: `${rate}%` },
          { label: "Pending Review", value: submitted + review + pendingApproval },
          { label: "Approved", value: approved },
        ],
      };
    }

    default:
      return null;
  }
}

// ── Intent data fetchers ──────────────────────────────────────────────────────

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
      return { submitted: await prisma.permitApplication.count({ where: { status: "SUBMITTED" } }) };
    }

    case "count_review": {
      const [review, pending] = await Promise.all([
        prisma.permitApplication.count({ where: { status: "UNDER_REVIEW" } }),
        prisma.permitApplication.count({ where: { status: "PENDING_APPROVAL" } }),
      ]);
      return { underReview: review, pendingSignoff: pending };
    }

    case "count_approved":
      return { approved: await prisma.permitApplication.count({ where: { status: "APPROVED" } }) };

    case "count_rejected":
      return { rejected: await prisma.permitApplication.count({ where: { status: "REJECTED" } }) };

    case "count_correction":
      return { requiresCorrection: await prisma.permitApplication.count({ where: { status: "REQUIRES_CORRECTION" } }) };

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
  `Sound like a helpful colleague, not a dashboard. Keep it concise. ` +
  `Use markdown: **bold** key figures and application references, bullet lists for grouped info. ` +
  `When an action has been identified (approve, reject, summarize etc.), briefly confirm what you found ` +
  `and let the user know the action card below is ready for them to confirm. ` +
  `When you ask a question with 2–4 clear choices, append [SUGGEST: Choice A | Choice B | Other] at the end.`;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userRole = (session.user as any).role as string;
    if (userRole !== "OFFICER" && userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { messages, provider, includeVisualization, includeActions } = body;
    const lastMessage: string =
      messages?.filter((m: any) => m.role === "user").pop()?.content?.trim() || "";

    if (!lastMessage) return NextResponse.json({ response: "What would you like to know?" });

    // 1. Run all classifiers in parallel
    const [intent, vizIntent, actionIntent] = await Promise.all([
      classifyIntent(lastMessage),
      includeVisualization ? classifyVisualization(lastMessage) : Promise.resolve(null),
      includeActions ? classifyAction(lastMessage) : Promise.resolve(null),
    ]);

    // 2. Fetch visualization data + resolve action target in parallel
    const [visualizationData, actionResolved, intentData] = await Promise.all([
      vizIntent ? fetchVisualizationData(vizIntent) : Promise.resolve(null),
      actionIntent ? resolveApplication(lastMessage, actionIntent) : Promise.resolve(null),
      fetchData(intent, session.user.id, userRole),
    ]);

    const actionData: ProposedAction | null =
      actionIntent && actionResolved ? buildActionProposal(actionIntent, actionResolved) : null;

    // 3. Build enriched system prompt
    let systemWithData = SYSTEM_PROMPT;
    if (intentData) {
      systemWithData += `\n\nCurrent data:\n${JSON.stringify(intentData, null, 2)}`;
    }
    if (actionData) {
      systemWithData += `\n\nAction identified: "${actionData.label}" for "${actionData.description}". Confirm this naturally and say the action card below is ready.`;
    }

    // 4. Generate response
    const rawResponse = await chat(
      [{ role: "system", content: systemWithData }, ...(messages as Message[])],
      200,
      provider
    );

    // Parse and strip [SUGGEST: a | b | c] tag
    const suggestionMatch = rawResponse.match(/\[SUGGEST:\s*([^\]]+)\]/i);
    const suggestions = suggestionMatch
      ? suggestionMatch[1].split("|").map((s: string) => s.trim()).filter(Boolean)
      : undefined;
    const response = rawResponse.replace(/\[SUGGEST:[^\]]*\]/gi, "").trim();

    return NextResponse.json({
      response,
      suggestions,
      visualization: visualizationData,
      action: actionData,
    });
  } catch (error) {
    console.error("Staff chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
