export interface User {
    id: string;
    name?: string;
    email: string;
    image?: string;
    role: UserRole;
    phone?: string;
    organization?: string;
    createdAt: string;
    updatedAt: string;
}

export type UserRole = "APPLICANT" | "OFFICER" | "ADMIN";

export interface Session {
    user: {
        id: string;
        name?: string;
        email: string;
        image?: string;
        role: UserRole;
    };
    expires: string;
}
