import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateTime(date: string | Date | undefined | null) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy h:mm a");
}

export function getStatusLabel(status: string) {
  switch (status) {
    case "SUBMITTED":
      return "Submitted";
    case "UNDER_REVIEW":
      return "Under Review";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "REQUIRES_CORRECTION":
      return "Requires Correction";
    default:
      return status;
  }
}

export function getStatusColor(status: string) {
  switch (status) {
    case "SUBMITTED":
      return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100";
    case "UNDER_REVIEW":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100";
    case "APPROVED":
      return "bg-green-100 text-green-800 border-green-200 hover:bg-green-100";
    case "REJECTED":
      return "bg-red-100 text-red-800 border-red-200 hover:bg-red-100";
    case "REQUIRES_CORRECTION":
      return "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100";
  }
}
