export type HRTabType = 'requests' | 'outgoing' | 'incoming' | 'dossiers' | 'orders' | 'overview';

export interface OutgoingMailItem {
    id: string;
    mailNumber: string;
    mailDate: string;
    recipient: string;
    subject: string;
    category: 'official_letter' | 'admin_order' | 'circular' | 'endorsement' | 'internal_memo';
    priority: 'normal' | 'urgent' | 'top_urgent' | 'confidential';
    signatoryName: string;
    signatoryTitle: string;
    attachmentsCount: number;
    status: 'draft' | 'issued' | 'archived';
    notes?: string;
    createdAt: string;
}

export interface IncomingMailItem {
    id: string;
    incomingNumber: string;
    incomingDate: string;
    originalNumber: string;
    originalDate: string;
    sender: string;
    subject: string;
    forwardedTo: string;
    requiredAction: string;
    priority: 'normal' | 'urgent' | 'top_urgent' | 'confidential';
    status: 'new' | 'in_progress' | 'completed' | 'archived';
    attachmentsCount: number;
    notes?: string;
    createdAt: string;
}

export interface DossierDocument {
    id: string;
    employeeId: string;
    category: 'personal_ids' | 'appointment' | 'promotions' | 'penalties_thanks' | 'leaves';
    title: string;
    documentNumber?: string;
    documentDate?: string;
    fileUrl?: string;
    fileType?: string;
    notes?: string;
    uploadedAt: string;
}

export interface AdminOrderItem {
    id: string;
    orderNumber: string;
    orderDate: string;
    orderType: 'assignment' | 'committee' | 'leave_grant' | 'appreciation' | 'penalty' | 'promotion';
    subject: string;
    targetEmployees: string[];
    legalBasis?: string;
    orderContent: string;
    signatory: string;
    status: 'active' | 'archived' | 'canceled';
    createdAt: string;
}
