export interface Email {
  id: string;
  provider: 'gmail' | 'outlook';
  from: string;
  subject: string;
  date: string;
  snippet: string;
  body?: string;
  bodyHtml?: string;
  isRead: boolean;
  threadId: string;
  accountEmail: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  priority_override?: string;
  priorityReason?: string;
  reason?: string;
  // Computed for thread grouping (not stored in DB)
  threadCount?: number;
  threadEmails?: Email[];
}

export function isCalendarEmail(email: Email): boolean {
  const s = email.subject || '';
  return /^(Invitation|Accepted|Tentative|Declined|Canceled|Updated invitation):/i.test(s);
}
