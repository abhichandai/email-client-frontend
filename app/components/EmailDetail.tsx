'use client';

import { useState } from 'react';
import { Email } from '../types';

interface EmailDetailProps {
  email: Email | null;
  onReply: (email: Email) => void;
  onClose: () => void;
  isMobile?: boolean;
  onPriorityChange?: (email: Email, priority: string) => void;
  onMarkRead?: (email: Email, isRead: boolean) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: '#e05c5c',
  MEDIUM: '#d4a853',
  LOW: '#666',
};

const PRIORITY_LABELS: Record<string, string> = {
  HIGH: '🔴 Priority',
  MEDIUM: '🟡 Important',
  LOW: '⚫ Low',
};

export default function EmailDetail({ email, onReply, onClose, isMobile, onPriorityChange, onMarkRead }: EmailDetailProps) {
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);

  if (!email) {
    if (isMobile) return null;
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', color: 'var(--text-muted)',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>✉</div>
        <div style={{ fontSize: 13 }}>Select an email to read</div>
      </div>
    );
  }

  const priority = email.priority_override || email.priority;

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        padding: '12px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        background: 'linear-gradient(180deg, rgba(212,168,83,0.02) 0%, transparent 100%)',
      }}>
        {isMobile && (
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: 18, marginRight: 8 }}>←</button>
        )}

        {/* Priority picker */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPriorityMenu(!showPriorityMenu)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px',
              background: 'var(--bg-3)',
              border: `1px solid ${PRIORITY_COLORS[priority] || '#444'}`,
              borderRadius: 5, fontSize: 11,
              color: PRIORITY_COLORS[priority] || 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_COLORS[priority] || '#444' }} />
            {PRIORITY_LABELS[priority] || priority}
            <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
          </button>
          {showPriorityMenu && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4,
              background: 'var(--bg-3)', border: '1px solid var(--border)',
              borderRadius: 6, zIndex: 50, overflow: 'hidden', minWidth: 150,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}>
              {(['HIGH', 'MEDIUM', 'LOW'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => { onPriorityChange?.(email, p); setShowPriorityMenu(false); }}
                  style={{
                    width: '100%', padding: '9px 14px', textAlign: 'left',
                    fontSize: 12, color: PRIORITY_COLORS[p], display: 'flex', alignItems: 'center', gap: 8,
                    borderBottom: p !== 'LOW' ? '1px solid var(--border)' : 'none',
                    background: p === priority ? 'rgba(255,255,255,0.04)' : 'transparent',
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                  onMouseOut={e => (e.currentTarget.style.background = p === priority ? 'rgba(255,255,255,0.04)' : 'transparent')}
                >
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: PRIORITY_COLORS[p] }} />
                  {PRIORITY_LABELS[p]}
                  {p === priority && <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.5 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mark read/unread */}
        <button
          onClick={() => onMarkRead?.(email, !email.isRead)}
          style={{
            padding: '5px 10px', background: 'var(--bg-3)',
            border: '1px solid var(--border)', borderRadius: 5, fontSize: 11,
            color: 'var(--text-muted)', cursor: 'pointer',
          }}
          onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          title={email.isRead ? 'Mark as unread' : 'Mark as read'}
        >
          {email.isRead ? '○ Mark Unread' : '● Mark Read'}
        </button>

        {/* Reply */}
        <button
          onClick={() => onReply(email)}
          style={{
            marginLeft: 'auto', padding: '5px 14px',
            background: '#d4a853', color: '#0a0a0a',
            borderRadius: 5, fontSize: 12, fontWeight: 500,
          }}
          onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseOut={e => (e.currentTarget.style.opacity = '1')}
        >Reply</button>
      </div>

      {/* Email content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 16px' : '28px 32px' }}>
        {/* Subject */}
        <h2 style={{
          fontFamily: 'Instrument Serif, serif',
          fontSize: isMobile ? 20 : 24,
          fontWeight: 400,
          color: 'var(--text)',
          marginBottom: 16,
          lineHeight: 1.3,
        }}>
          {email.subject || '(no subject)'}
        </h2>

        {/* From / Date */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: 20, gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
              {email.from?.replace(/<.*>/, '').trim()}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {email.from?.match(/<(.+)>/)?.[1] || email.from}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, textAlign: 'right' }}>
            {email.date ? new Date(email.date).toLocaleString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            }) : ''}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />

        {/* AI reason */}
        {email.reason && (
          <div style={{
            padding: '8px 12px', background: 'rgba(212,168,83,0.06)',
            border: '1px solid rgba(212,168,83,0.12)', borderRadius: 6,
            fontSize: 11, color: 'var(--text-muted)', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: '#d4a853', fontSize: 13 }}>⚡</span>
            {email.reason}
          </div>
        )}

        {/* Body (snippet for now) */}
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.8 }}>
          {email.snippet}
          <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-2)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            Full email body coming soon — Gmail API upgrade needed for complete message content.
          </div>
        </div>
      </div>
    </div>
  );
}
