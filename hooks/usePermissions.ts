"use client";

import { useSession } from "@/hooks/useSession";
import { hasPermission, canAccessRoute, getNavItems } from "@/lib/rbac";
import type { Permission } from "@/lib/rbac";
import type { UserRole } from "@/lib/types";

/**
 * Central hook for all role/permission checks.
 *
 * Usage:
 *   const { can, role, isAdmin, isOfficer, isApplicant } = usePermissions();
 *   if (can("approve_application")) { ... }
 */
export function usePermissions() {
    const { data: session, status } = useSession();

    const role = (session?.user as { role?: UserRole } | undefined)?.role;
    const isLoading = status === "loading";

    return {
        role,
        isLoading,
        isAuthenticated: !!session,
        isAdmin:     role === "ADMIN",
        isOfficer:   role === "OFFICER",
        isApplicant: role === "APPLICANT",
        isStaff:     role === "OFFICER" || role === "ADMIN",

        /** Check a named permission from lib/rbac.ts PERMISSIONS map. */
        can: (action: Permission): boolean => hasPermission(role, action),

        /** Check if the current user may navigate to a given pathname. */
        canAccess: (pathname: string): boolean => canAccessRoute(role, pathname),

        /** Sidebar nav items filtered for the current role. */
        navItems: getNavItems(role),
    };
}
