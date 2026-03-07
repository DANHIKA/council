export interface Application {
    id: string;
    permitType: string;
    permitTypeId: string | null;
    description: string;
    location: string;
    latitude?: number;
    longitude?: number;
    status: ApplicationStatus;
    createdAt: string;
    updatedAt: string;
    reviewedAt?: string;
    approvedAt?: string;
    applicant: Applicant;
    officer?: Officer;
    permitTypeRef?: PermitTypeRef;
    documents: Document[];
    comments: Comment[];
    certificate?: Certificate;
    timeline: TimelineEvent[];
}

export interface Applicant {
    id: string;
    name: string;
    email: string;
    phone?: string;
    organization?: string;
}

export interface Officer {
    id: string;
    name: string;
    email: string;
}

export interface PermitTypeRef {
    id: string;
    name: string;
    code: string;
    requirements: PermitRequirement[];
}

export interface Document {
    id: string;
    name: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    status: DocumentStatus;
    reviewNotes?: string;
    createdAt: string;
    requirementId: string | null;
    requirement?: {
        key: string;
        label: string;
    };
}

export interface Comment {
    id: string;
    content: string;
    isInternal: boolean;
    createdAt: string;
    author: {
        id: string;
        name: string;
        role: string;
    };
}

export interface Certificate {
    id: string;
    certificateNo: string;
    issueDate: string;
    expiryDate: string;
    downloadCount: number;
}

export interface TimelineEvent {
    id: string;
    event: string;
    description?: string;
    status: string;
    createdAt: string;
}

export type ApplicationStatus = 
    | "SUBMITTED"
    | "UNDER_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | "REQUIRES_CORRECTION";

export type DocumentStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface PermitType {
    id: string;
    code: string;
    name: string;
    description?: string;
    requirements: PermitRequirement[];
}

export interface PermitRequirement {
    id: string;
    key: string;
    label: string;
    description?: string;
    required: boolean;
    acceptMime?: string;
    acceptExt?: string;
    sortOrder: number;
}

export interface UploadedDocument {
    id: string;
    name: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    status: DocumentStatus;
    reviewNotes?: string;
    createdAt: string;
    requirement?: {
        key: string;
        label: string;
    };
}
