"use client";

import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import type { Permission } from "@/lib/rbac";
import type { UserRole } from "@/lib/types";

interface PermissionGuardProps {
    /** Named action from the PERMISSIONS map. */
    action?: Permission;
    /** Explicit role list (alternative to action). */
    roles?: UserRole[];
    /** Rendered when the check fails instead of rendering nothing. */
    fallback?: ReactNode;
    children: ReactNode;
}

/**
 * Renders children only when the current user satisfies the permission check.
 *
 * Examples:
 *   <PermissionGuard action="submit_application">
 *     <Button>New Application</Button>
 *   </PermissionGuard>
 *
 *   <PermissionGuard roles={["OFFICER", "ADMIN"]}>
 *     <OfficerActions />
 *   </PermissionGuard>
 *
 *   <PermissionGuard action="manage_users" fallback={<p>Access denied</p>}>
 *     <AdminPanel />
 *   </PermissionGuard>
 */
export function PermissionGuard({
    action,
    roles,
    fallback = null,
    children,
}: PermissionGuardProps) {
    const { can, role, isLoading } = usePermissions();

    if (isLoading) return null;

    const allowed =
        (action !== undefined && can(action)) ||
        (roles !== undefined && role !== undefined && roles.includes(role));

    return allowed ? <>{children}</> : <>{fallback}</>;
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

interface RoleGuardProps {
    roles: UserRole[];
    fallback?: ReactNode;
    children: ReactNode;
}

/** Shorthand for role-based visibility without a named permission. */
export function RoleGuard({ roles, fallback = null, children }: RoleGuardProps) {
    return (
        <PermissionGuard roles={roles} fallback={fallback}>
            {children}
        </PermissionGuard>
    );
}

/** Visible only to APPLICANTs. */
export function ApplicantOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
    return <RoleGuard roles={["APPLICANT"]} fallback={fallback}>{children}</RoleGuard>;
}

/** Visible only to OFFICERs and ADMINs. */
export function StaffOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
    return <RoleGuard roles={["OFFICER", "ADMIN"]} fallback={fallback}>{children}</RoleGuard>;
}

/** Visible only to ADMINs. */
export function AdminOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
    return <RoleGuard roles={["ADMIN"]} fallback={fallback}>{children}</RoleGuard>;
}
