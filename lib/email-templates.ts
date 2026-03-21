const appName = process.env.NEXT_PUBLIC_APP_NAME || "Council Permit Portal";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function base(content: string) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%">
        <tr style="background:#1a1a2e">
          <td style="padding:24px 32px">
            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:bold">${appName}</p>
          </td>
        </tr>
        <tr><td style="padding:32px">${content}</td></tr>
        <tr style="background:#f4f4f5">
          <td style="padding:16px 32px">
            <p style="margin:0;color:#71717a;font-size:12px">This is an automated message. Do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(href: string, label: string, color: string) {
    return `<a href="${href}" style="display:inline-block;padding:10px 20px;background:${color};color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;margin:4px 4px 4px 0">${label}</a>`;
}

export function newApplicationEmail(opts: {
    officerName: string;
    applicantName: string;
    applicantEmail: string;
    permitType: string;
    description: string;
    location: string;
    applicationId: string;
    recommendToken: string;
    correctionsToken: string;
    rejectToken: string;
}) {
    const reviewUrl = `${appUrl}/officer/review/${opts.applicationId}`;
    const recommendUrl = `${appUrl}/api/email-action/${opts.recommendToken}`;
    const correctionsUrl = `${appUrl}/api/email-action/${opts.correctionsToken}`;
    const rejectUrl = `${appUrl}/api/email-action/${opts.rejectToken}`;

    return base(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111">New Application Awaiting Review</h2>
      <p style="margin:0 0 24px;color:#52525b;font-size:14px">Hello ${opts.officerName}, a new permit application has been submitted and is pending your review.</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:6px;margin-bottom:24px">
        <tr><td style="padding:20px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:4px 0"><span style="color:#71717a;font-size:12px;display:block">Permit Type</span><span style="font-size:14px;font-weight:600;color:#111">${opts.permitType}</span></td>
            </tr>
            <tr>
              <td style="padding:8px 0 4px"><span style="color:#71717a;font-size:12px;display:block">Applicant</span><span style="font-size:14px;color:#111">${opts.applicantName} &lt;${opts.applicantEmail}&gt;</span></td>
            </tr>
            <tr>
              <td style="padding:4px 0"><span style="color:#71717a;font-size:12px;display:block">Location</span><span style="font-size:14px;color:#111">${opts.location}</span></td>
            </tr>
            <tr>
              <td style="padding:8px 0 4px"><span style="color:#71717a;font-size:12px;display:block">Description</span><span style="font-size:14px;color:#111">${opts.description}</span></td>
            </tr>
          </table>
        </td></tr>
      </table>

      <p style="margin:0 0 12px;font-size:13px;color:#52525b;font-weight:600">Quick Actions</p>
      <p style="margin:0 0 16px;font-size:12px;color:#71717a">These are single-use links valid for 48 hours. For full review, use the portal.</p>
      <div>
        ${btn(recommendUrl, "&#x2713; Recommend Approval", "#16a34a")}
        ${btn(correctionsUrl, "&#x26A0; Request Corrections", "#d97706")}
        ${btn(rejectUrl, "&#x2717; Reject", "#dc2626")}
      </div>
      <div style="margin-top:16px">
        ${btn(reviewUrl, "Open in Portal &rarr;", "#2563eb")}
      </div>
      <p style="margin:16px 0 0;font-size:11px;color:#a1a1aa">Clicking Recommend Approval, Request Corrections, or Reject will immediately process the decision. Use the portal for providing detailed notes.</p>
    `);
}

export function pendingSignoffEmail(opts: {
    adminName: string;
    officerName: string;
    applicantName: string;
    applicantEmail: string;
    permitType: string;
    description: string;
    location: string;
    applicationId: string;
    approveToken: string;
    rejectToken: string;
}) {
    const reviewUrl = `${appUrl}/officer/review/${opts.applicationId}`;
    const approveUrl = `${appUrl}/api/email-action/${opts.approveToken}`;
    const rejectUrl = `${appUrl}/api/email-action/${opts.rejectToken}`;

    return base(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111">Application Pending Your Sign-off</h2>
      <p style="margin:0 0 24px;color:#52525b;font-size:14px">Hello ${opts.adminName}, Officer <strong>${opts.officerName}</strong> has recommended approval for the following application and it requires your final sign-off.</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:6px;margin-bottom:24px">
        <tr><td style="padding:20px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:4px 0"><span style="color:#71717a;font-size:12px;display:block">Permit Type</span><span style="font-size:14px;font-weight:600;color:#111">${opts.permitType}</span></td>
            </tr>
            <tr>
              <td style="padding:8px 0 4px"><span style="color:#71717a;font-size:12px;display:block">Applicant</span><span style="font-size:14px;color:#111">${opts.applicantName} &lt;${opts.applicantEmail}&gt;</span></td>
            </tr>
            <tr>
              <td style="padding:4px 0"><span style="color:#71717a;font-size:12px;display:block">Location</span><span style="font-size:14px;color:#111">${opts.location}</span></td>
            </tr>
            <tr>
              <td style="padding:8px 0 4px"><span style="color:#71717a;font-size:12px;display:block">Description</span><span style="font-size:14px;color:#111">${opts.description}</span></td>
            </tr>
          </table>
        </td></tr>
      </table>

      <p style="margin:0 0 12px;font-size:13px;color:#52525b;font-weight:600">Final Decision</p>
      <p style="margin:0 0 16px;font-size:12px;color:#71717a">These are single-use links valid for 48 hours. Use the portal for detailed notes.</p>
      <div>
        ${btn(approveUrl, "&#x2713; Final Approve", "#16a34a")}
        ${btn(rejectUrl, "&#x2717; Reject", "#dc2626")}
      </div>
      <div style="margin-top:16px">
        ${btn(reviewUrl, "Review in Portal &rarr;", "#2563eb")}
      </div>
    `);
}

export function decisionEmail(opts: {
    applicantName: string;
    permitType: string;
    decision: "APPROVED" | "REJECTED" | "REQUIRES_CORRECTION";
    notes?: string;
    applicationId: string;
    certificateNo?: string;
}) {
    const viewUrl = `${appUrl}/applications/${opts.applicationId}`;

    const decisionLabel = {
        APPROVED: "Approved &#x2713;",
        REJECTED: "Rejected",
        REQUIRES_CORRECTION: "Corrections Required",
    }[opts.decision];

    const decisionColor = {
        APPROVED: "#16a34a",
        REJECTED: "#dc2626",
        REQUIRES_CORRECTION: "#d97706",
    }[opts.decision];

    const decisionMessage = {
        APPROVED: "Congratulations! Your application has been approved.",
        REJECTED: "Unfortunately, your application has been rejected.",
        REQUIRES_CORRECTION: "Your application requires corrections before it can proceed.",
    }[opts.decision];

    return base(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#111">Application Update: <span style="color:${decisionColor}">${decisionLabel}</span></h2>
      <p style="margin:0 0 24px;color:#52525b;font-size:14px">Hello ${opts.applicantName}, ${decisionMessage}</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:6px;margin-bottom:24px">
        <tr><td style="padding:20px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:4px 0"><span style="color:#71717a;font-size:12px;display:block">Permit Type</span><span style="font-size:14px;font-weight:600;color:#111">${opts.permitType}</span></td>
            </tr>
            <tr>
              <td style="padding:8px 0 4px"><span style="color:#71717a;font-size:12px;display:block">Decision</span><span style="font-size:14px;font-weight:600;color:${decisionColor}">${decisionLabel}</span></td>
            </tr>
            ${opts.notes ? `<tr><td style="padding:8px 0 4px"><span style="color:#71717a;font-size:12px;display:block">Notes from Reviewer</span><span style="font-size:14px;color:#111">${opts.notes}</span></td></tr>` : ""}
            ${opts.certificateNo ? `<tr><td style="padding:8px 0 4px"><span style="color:#71717a;font-size:12px;display:block">Certificate Number</span><span style="font-size:14px;font-weight:600;font-family:monospace;color:#16a34a">${opts.certificateNo}</span></td></tr>` : ""}
          </table>
        </td></tr>
      </table>

      ${opts.decision === "REQUIRES_CORRECTION" ? `<p style="margin:0 0 16px;font-size:13px;color:#52525b">Please log in to your account and resubmit the corrected documents.</p>` : ""}

      <div>${btn(viewUrl, "View Application &rarr;", "#2563eb")}</div>
    `);
}
