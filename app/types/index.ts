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
  isCompleted?: boolean;
  category?: 'INBOX' | 'MARKETING';
  // Computed for thread grouping
  threadCount?: number;
  threadEmails?: Email[];
}

export function isCalendarEmail(email: Email): boolean {
  const s = email.subject || '';
  return /^(Invitation|Accepted|Tentative|Declined|Canceled|Updated invitation):/i.test(s);
}
