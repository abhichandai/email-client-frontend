export interface Email {
  id: string;
  provider: 'gmail' | 'outlook';
  from: string;
  subject: string;
  date: string;
  snippet: string;
  isRead: boolean;
  threadId: string;
  accountEmail: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  priority_override?: string;
  priorityReason?: string;
  reason?: string;
}
