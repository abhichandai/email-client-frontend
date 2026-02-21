'use client';

import { useState } from 'react';
import { Email } from '../types';
import { useAccounts } from '../context/accounts';

interface EmailDetailProps {
  email: Email | null;
  onReply: (email: Email) => void;
  onClose: () => void;
  isMobile?: boolean;
  onEmailUpdate?: (updated: Partial<Email> & { id: string }) => void;
  onBulkUpdate?: (emails: Email[]) => void;
}

const PRIORITY_OPTIONS = [
  { value: 'HIGH', label: 'Priority', color: '#e05c5c' },
  { value: 'MEDIUM', label: 'Important', color: '#d4a853' },
  { value: 'LOW', label: 'Low', color: '#666' },
];

export default function EmailDetail({ email, onReply, onClose, isMobile, onEmailUpdate, onBulkUpdate }: EmailDetailProps) {
  const { accounts } = useAccounts();
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [savingPriority, setSavingPriority] = useState(false);
  const [localPriority, setLocalPriority] = useState<string | null>(null);
  const [localIsRead, setLocalIsRead] = useState<boolean | null>(null);

  if (!email) {
    if (isMobile) return null;
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 40, opacity: 0.3 }}>✉</div>
        <div style={{ fontSize: 13 }}>Select an email to read</div>
      </div>
    );
  }

  const priority = localPriority || email.priority || 'MEDIUM';
  const isRead = localIsRead !== null ? localIsRead : email.isRead;
  const priorityConfig = PRIORITY_OPTIONS.find(p => p.value === priority) || PRIORITY_OPTIONS[1];
  const accessToken = accounts[0]?.tokens?.access_token;
  const senderEmail = email.from?.match(/<(.+)>/)?.[1] || email.from || '';
  const senderName = email.from?.replace(/<.*>/, '').trim() || 'Unknown';

  const setPriority = async (newPriority: string, addToRules: boolean) => {
    setSavingPriority(true);
    setLocalPriority(newPriority);
    setShowPriorityMenu(false);
    try {
      const res = await fetch('/api/email/priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId: email.id, priority: newPriority, senderEmail, addToRules }),
      });
      const data = await res.json();

      if (addToRules && data.updatedEmails) {
        // Bulk update all emails in state — no resync needed
        onBulkUpdate?.(data.updatedEmails);
      } else {
        onEmailUpdate?.({ id: email.id, priority: newPriority as Email['priority'] });
      }
    } finally {
      setSavingPriority(false);
    }
  };

  const toggleRead = async () => {
    const newIsRead = !isRead;
    setLocalIsRead(newIsRead);
    await fetch('/api/email/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: email.id, isRead: newIsRead, accessToken }),
    });
    onEmailUpdate?.({ id: email.id, isRead: newIsRead });
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Toolbar */}
      <div style={{
        padding: '12px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        background: 'linear-gradient(180deg, rgba(212,168,83,0.02) 0%, transparent 100%)',
      }}>
        {isMobile && <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: 18, marginRight: 4 }}>←</button>}

        {/* Priority picker */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPriorityMenu(!showPriorityMenu)}
            disabled={savingPriority}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', background: 'var(--bg-2)',
              border: `1px solid ${priorityConfig.color}40`, borderRadius: 6,
              color: priorityConfig.color, fontSize: 12, fontWeight: 500,
            }}
          >
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: priorityConfig.color }} />
            {savingPriority ? 'Saving...' : priorityConfig.label}
            <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
          </button>

          {showPriorityMenu && (
            <div style={{
              position: 'absolute', top: '110%', left: 0, zIndex: 100,
              background: 'var(--bg-3)', border: '1px solid var(--border)',
              borderRadius: 8, overflow: 'hidden', minWidth: 220,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
              <div style={{ padding: '8px 12px 4px', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                This email only
              </div>
              {PRIORITY_OPTIONS.map(opt => (
                <button key={opt.value}
                  onClick={() => setPriority(opt.value, false)}
                  style={{ width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: opt.color, textAlign: 'left' }}
                  onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: opt.color }} />
                  {opt.label}
                </button>
              ))}

              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

              <div style={{ padding: '6px 12px 4px', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Always for {senderName.split(' ')[0]} — updates all their emails
              </div>
              {PRIORITY_OPTIONS.map(opt => (
                <button key={opt.value + '-rule'}
                  onClick={() => setPriority(opt.value, true)}
                  style={{ width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: opt.color, textAlign: 'left' }}
                  onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: opt.color }} />
                  Always {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Read toggle */}
        <button onClick={toggleRead} style={{
          padding: '5px 10px', background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 6, color: 'var(--text-muted)', fontSize: 12,
        }}
          onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          {isRead ? '◯ Mark unread' : '● Mark read'}
        </button>

        <div style={{ flex: 1 }} />
        <button onClick={() => onReply(email)} style={{
          padding: '5px 14px', background: '#d4a853', color: '#0a0a0a', borderRadius: 6, fontSize: 12, fontWeight: 500,
        }}>Reply</button>
      </div>

      {/* Email content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 16px' : '28px 32px' }}>
        <div style={{ maxWidth: 680 }}>
          <h2 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, marginBottom: 20, fontFamily: 'Instrument Serif, serif' }}>
            {email.subject || '(no subject)'}
          </h2>

          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24,
            padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: 'rgba(212,168,83,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#d4a853', fontSize: 15, fontWeight: 600, flexShrink: 0,
            }}>
              {senderName[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{senderName}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{senderEmail}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
              {email.date ? new Date(email.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
            </div>
          </div>

          {email.reason && (
            <div style={{
              padding: '10px 14px', marginBottom: 20,
              background: `${priorityConfig.color}10`, border: `1px solid ${priorityConfig.color}25`,
              borderRadius: 6, fontSize: 12, color: priorityConfig.color,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>⚡</span><span>{email.reason}</span>
            </div>
          )}

          <div style={{ fontSize: 14, lineHeight: 1.8, color: '#aaa', padding: '20px 0', borderTop: '1px solid var(--border)' }}>
            <p style={{ marginBottom: 12 }}>{email.snippet}</p>
            <p style={{ fontSize: 12, color: '#444', marginTop: 24 }}>Full email body coming soon — this is the preview snippet.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
