import { http } from "./http";

export interface Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: string;
    read: boolean;
    link?: string;
    createdAt: string;
}

export interface NotificationsResponse {
    notifications: Notification[];
    unreadCount: number;
}

export const notificationsApi = {
    getAll: () => http.get<NotificationsResponse>("/api/notifications"),
    
    markAllAsRead: () => http.patch<{ success: boolean }>("/api/notifications", {}),
    
    markAsRead: (id: string) => http.patch<{ notification: Notification }>(`/api/notifications/${id}/read`, {}),
};
