import type { UserRole } from "@/lib/types";

// ─── Action Permissions ───────────────────────────────────────────────────────
// Single source of truth for what each role can do.
// Add new actions here; hooks + guards pick them up automatically.

export const PERMISSIONS = {
    // Application lifecycle
    submit_application:       ["APPLICANT"],
    edit_own_application:     ["APPLICANT"],
    delete_own_document:      ["APPLICANT"],
    view_own_applications:    ["APPLICANT"],

    // Review workflow
    view_all_applications:    ["OFFICER", "ADMIN"],
    view_review_queue:        ["OFFICER", "ADMIN"],
    assign_application:       ["OFFICER", "ADMIN"],
    approve_application:      ["OFFICER", "ADMIN"],
    reject_application:       ["OFFICER", "ADMIN"],
    request_corrections:      ["OFFICER", "ADMIN"],
    add_internal_comment:     ["OFFICER", "ADMIN"],
    review_application:       ["OFFICER", "ADMIN"],

    // Administration
    manage_users:             ["ADMIN"],
    change_user_roles:        ["ADMIN"],
    view_admin_dashboard:     ["ADMIN"],
} as const satisfies Record<string, UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

// ─── Route Access Map ─────────────────────────────────────────────────────────
// Maps route prefixes to allowed roles.
// `null` means any authenticated user may access the route.

export const ROUTE_ACCESS: { pattern: RegExp; roles: UserRole[] | null }[] = [
    // Applicant-only
    { pattern: /^\/applications\/new$/,           roles: ["APPLICANT"] },
    { pattern: /^\/applications\/[^/]+\/edit$/,   roles: ["APPLICANT"] },

    // Officer + Admin
    { pattern: /^\/officer\//,                    roles: ["OFFICER", "ADMIN"] },

    // Admin only
    { pattern: /^\/admin/,                        roles: ["ADMIN"] },

    // Open to any authenticated user
    { pattern: /^\/dashboard/,                    roles: null },
    { pattern: /^\/applications/,                 roles: null },
    { pattern: /^\/map/,                          roles: null },
    { pattern: /^\/profile/,                      roles: null },
];

// ─── Sidebar Navigation Config ────────────────────────────────────────────────
// Drives the sidebar declaratively — no role logic inside the component.

export const NAV_ITEMS = [
    {
        title: "Dashboard",
        href: "/dashboard",
        icon: "Home01Icon" as const,
        roles: null, // visible to all
    },
    {
        title: "My Applications",
        href: "/applications",
        icon: "Note01Icon" as const,
        roles: ["APPLICANT"] as UserRole[],
    },
    {
        title: "New Application",
        href: "/applications/new",
        icon: "AddCircleIcon" as const,
        roles: ["APPLICANT"] as UserRole[],
    },
    {
        title: "Review Queue",
        href: "/officer/applications",
        icon: "UserGroupIcon" as const,
        roles: ["OFFICER", "ADMIN"] as UserRole[],
    },
    {
        title: "All Applications",
        href: "/applications",
        icon: "Note01Icon" as const,
        roles: ["OFFICER", "ADMIN"] as UserRole[],
    },
    {
        title: "Permit Map",
        href: "/map",
        icon: "Location01Icon" as const,
        roles: null,
    },
    {
        title: "Profile",
        href: "/profile",
        icon: "UserIcon" as const,
        roles: null,
    },
    {
        title: "Admin Dashboard",
        href: "/admin",
        icon: "DashboardCircleIcon" as const,
        roles: ["ADMIN"] as UserRole[],
    },
] satisfies {
    title: string;
    href: string;
    icon: string;
    roles: UserRole[] | null;
}[];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if the given role has the given permission. */
export function hasPermission(role: UserRole | undefined, action: Permission): boolean {
    if (!role) return false;
    return (PERMISSIONS[action] as readonly string[]).includes(role);
}

/** Returns true if the given role may access the given pathname. */
export function canAccessRoute(role: UserRole | undefined, pathname: string): boolean {
    if (!role) return false;
    for (const { pattern, roles } of ROUTE_ACCESS) {
        if (pattern.test(pathname)) {
            if (roles === null) return true;
            return roles.includes(role);
        }
    }
    // No matching rule → allow (public or unmatched pages)
    return true;
}

/** Returns the nav items visible to the given role. */
export function getNavItems(role: UserRole | undefined) {
    if (!role) return [];
    return NAV_ITEMS.filter((item) =>
        item.roles === null || item.roles.includes(role)
    );
}
