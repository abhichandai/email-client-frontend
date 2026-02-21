'use client';

import { Email } from '../types';

interface EmailDetailProps {
  email: Email | null;
  onReply: (email: Email) => void;
  onClose: () => void;
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

export default function EmailDetail({ email, onReply, onClose }: EmailDetailProps) {
  if (!email) {
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        padding: '16px 28px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 11,
            padding: '2px 10px',
            borderRadius: 10,
            background: p.bg,
            color: p.color,
            fontWeight: 500,
          }}>
            {p.label}
          </span>
          {email.priorityReason && (
            <span style={{ fontSize: 12, color: '#444', fontStyle: 'italic' }}>
              {email.priorityReason}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ color: '#444', fontSize: 18, padding: 4 }}
          onMouseOver={(e) => (e.currentTarget.style.color = '#888')}
          onMouseOut={(e) => (e.currentTarget.style.color = '#444')}
        >
          ×
        </button>
      </div>

      {/* Email header */}
      <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{
          fontSize: 20,
          fontFamily: 'Instrument Serif, serif',
          fontWeight: 400,
          color: '#e8e8e8',
          marginBottom: 16,
          lineHeight: 1.3,
        }}>
          {email.subject || '(no subject)'}
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Avatar */}
            <div style={{
              width: 36,
              height: 36,
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
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
        padding: '16px 28px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: 10,
      }}>
        <button
          onClick={() => onReply(email)}
          style={{
            padding: '8px 20px',
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
            padding: '8px 20px',
            background: 'rgba(255,255,255,0.05)',
            color: '#888',
            borderRadius: 6,
            fontSize: 13,
            border: '1px solid #222',
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = '#ccc')}
          onMouseOut={(e) => (e.currentTarget.style.color = '#888')}
        >
          Forward
        </button>
        <span style={{
          fontSize: 11,
          marginLeft: 'auto',
          color: '#333',
          alignSelf: 'center',
          background: 'rgba(255,255,255,0.03)',
          padding: '4px 10px',
          borderRadius: 10,
        }}>
          via {email.provider} · {email.accountEmail}
        </span>
      </div>
    </div>
  );
}
