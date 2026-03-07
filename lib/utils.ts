import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function getStatusColor(status: string): string {
    switch (status) {
        case 'SUBMITTED':
            return 'bg-blue-100 text-blue-800';
        case 'UNDER_REVIEW':
            return 'bg-yellow-100 text-yellow-800';
        case 'APPROVED':
            return 'bg-green-100 text-green-800';
        case 'REJECTED':
            return 'bg-red-100 text-red-800';
        case 'REQUIRES_CORRECTION':
            return 'bg-orange-100 text-orange-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

export function getStatusLabel(status: string): string {
    switch (status) {
        case 'SUBMITTED':
            return 'Submitted';
        case 'UNDER_REVIEW':
            return 'Under Review';
        case 'APPROVED':
            return 'Approved';
        case 'REJECTED':
            return 'Rejected';
        case 'REQUIRES_CORRECTION':
            return 'Requires Correction';
        default:
            return status;
    }
}
