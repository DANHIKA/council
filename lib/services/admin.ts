import { http } from "./http";

export interface AdminUser {
    id: string;
    name: string;
    email: string;
    role: "APPLICANT" | "OFFICER" | "ADMIN";
    department?: string;
    createdAt: string;
    _count: {
        applications: number;
    };
}

export interface AdminUsersResponse {
    users: AdminUser[];
}

export const adminApi = {
    getUsers: () => http.get<AdminUsersResponse>("/api/admin/users"),
    
    updateUserRole: (userId: string, role: string) => 
        http.patch<{ user: AdminUser }>("/api/admin/users", { userId, role }),
};
