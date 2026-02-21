'use client';

import { Email } from '../types';

interface EmailDetailProps {
  email: Email | null;
  onReply: (email: Email) => void;
  onClose: () => void;
  isMobile?: boolean;
}

function parseFrom(from: string) {
  const match = from.match(/^(.+?)\s*<(.+)>$/);
  if (match) return { name: match[1].replace(/"/g, ''), email: match[2] };
  return { name: from, email: from };
}

const priorityColors: Record<string, { bg: string; color: string; label: string }> = {
  HIGH: { bg: 'rgba(224,92,92,0.1)', color: '#e05c5c', label: 'Priority' },
  MEDIUM: { bg: 'rgba(212,168,83,0.1)', color: '#d4a853', label: 'Important' },
  LOW: { bg: 'rgba(255,255,255,0.04)', color: '#555', label: 'Low' },
};

export default function EmailDetail({ email, onReply, onClose, isMobile }: EmailDetailProps) {
  if (!email) {
    if (isMobile) return null;
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#2a2a2a',
        flexDirection: 'column',
        gap: 12,
      }}>
        <div style={{ fontSize: 48, opacity: 0.3 }}>✉</div>
        <div style={{ fontSize: 14, color: '#333' }}>Select an email to read</div>
      </div>
    );
  }

  const { name, email: fromEmail } = parseFrom(email.from);
  const p = priorityColors[email.priority];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' }}>
      {/* Top bar */}
      <div style={{
        padding: isMobile ? '14px 16px' : '16px 28px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
          {/* Back button on mobile */}
          {isMobile && (
            <button
              onClick={onClose}
              style={{ color: '#888', fontSize: 20, flexShrink: 0, padding: '2px 4px' }}
            >
              ←
            </button>
          )}
          <span style={{
            fontSize: 11,
            padding: '2px 10px',
            borderRadius: 10,
            background: p.bg,
            color: p.color,
            fontWeight: 500,
            flexShrink: 0,
          }}>
            {p.label}
          </span>
          {email.priorityReason && !isMobile && (
            <span style={{ fontSize: 12, color: '#444', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email.priorityReason}
            </span>
          )}
        </div>
        {!isMobile && (
          <button
            onClick={onClose}
            style={{ color: '#444', fontSize: 18, padding: 4, flexShrink: 0 }}
            onMouseOver={(e) => (e.currentTarget.style.color = '#888')}
            onMouseOut={(e) => (e.currentTarget.style.color = '#444')}
          >
            ×
          </button>
        )}
      </div>

      {/* Email header */}
      <div style={{ padding: isMobile ? '16px' : '24px 28px 20px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{
          fontSize: isMobile ? 17 : 20,
          fontFamily: 'Instrument Serif, serif',
          fontWeight: 400,
          color: '#e8e8e8',
          marginBottom: 14,
          lineHeight: 1.3,
        }}>
          {email.subject || '(no subject)'}
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #d4a853, #8b6914)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 600,
              color: '#0a0a0a',
              flexShrink: 0,
            }}>
              {name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, color: '#e8e8e8', fontWeight: 500 }}>{name}</div>
              <div style={{ fontSize: 12, color: '#555' }}>{fromEmail}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#444' }}>
            {new Date(email.date).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '24px 28px' }}>
        <div style={{
          fontSize: 14,
          color: '#aaa',
          lineHeight: 1.8,
          fontStyle: 'italic',
          borderLeft: '2px solid #222',
          paddingLeft: 16,
        }}>
          {email.snippet}
          <div style={{ marginTop: 16, color: '#444', fontSize: 12 }}>
            — Full email body requires additional Gmail/Outlook API scope. This shows the preview snippet.
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        padding: isMobile ? '12px 16px' : '16px 28px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}>
        <button
          onClick={() => onReply(email)}
          style={{
            padding: isMobile ? '10px 24px' : '8px 20px',
            background: '#d4a853',
            color: '#0a0a0a',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Reply
        </button>
        <button
          style={{
            padding: isMobile ? '10px 24px' : '8px 20px',
            background: 'rgba(255,255,255,0.05)',
            color: '#888',
            borderRadius: 6,
            fontSize: 13,
            border: '1px solid #222',
          }}
        >
          Forward
        </button>
        {!isMobile && (
          <span style={{
            fontSize: 11,
            marginLeft: 'auto',
            color: '#333',
            background: 'rgba(255,255,255,0.03)',
            padding: '4px 10px',
            borderRadius: 10,
          }}>
            via {email.provider} · {email.accountEmail}
          </span>
        )}
      </div>
    </div>
  );
}
