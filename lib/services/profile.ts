import { http } from "./http";

export interface UserProfile {
    id: string;
    name: string | null;
    email: string;
    role: string;
    phone: string | null;
    organization: string | null;
    createdAt?: string;
}

export interface ProfileResponse {
    user: UserProfile;
}

export const profileApi = {
    getProfile: () => http.get<ProfileResponse>("/api/profile"),
    
    updateProfile: (data: { name: string; phone?: string; organization?: string }) => 
        http.patch<ProfileResponse>("/api/profile", data),
};
