'use client';

import { Email } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface EmailListProps {
  emails: Email[];
  loading: boolean;
  selected: Email | null;
  onSelect: (email: Email) => void;
  onRefresh: () => void;
}

const priorityDot: Record<string, string> = {
  HIGH: '#e05c5c',
  MEDIUM: '#d4a853',
  LOW: '#333',
};

function parseFrom(from: string) {
  const match = from.match(/^(.+?)\s*<(.+)>$/);
  if (match) return { name: match[1].replace(/"/g, ''), email: match[2] };
  return { name: from, email: from };
}

export default function EmailList({ emails, loading, selected, onSelect, onRefresh }: EmailListProps) {
  return (
    <div style={{
      width: 360,
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 13, color: '#666' }}>
          {loading ? 'Loading...' : `${emails.length} messages`}
        </div>
        <button
          onClick={onRefresh}
          style={{ color: '#666', fontSize: 16, padding: 4, transition: 'color 0.15s' }}
          onMouseOver={(e) => (e.currentTarget.style.color = '#d4a853')}
          onMouseOut={(e) => (e.currentTarget.style.color = '#666')}
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {/* Email rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && !emails.length ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#444' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⟳</div>
            Fetching & prioritizing...
          </div>
        ) : !emails.length ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#444' }}>
            No emails to show.<br />
            <span style={{ fontSize: 12, color: '#333' }}>Connect an account to get started.</span>
          </div>
        ) : (
          emails.map((email) => {
            const { name } = parseFrom(email.from);
            const isSelected = selected?.id === email.id;
            return (
              <button
                key={email.id}
                onClick={() => onSelect(email)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 20px',
                  background: isSelected ? 'rgba(212,168,83,0.06)' : 'transparent',
                  borderBottom: '1px solid var(--border)',
                  borderLeft: isSelected ? '2px solid #d4a853' : '2px solid transparent',
                  transition: 'background 0.1s',
                  cursor: 'pointer',
                  display: 'block',
                }}
                onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Row top */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: priorityDot[email.priority],
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 13,
                      fontWeight: email.isRead ? 400 : 600,
                      color: email.isRead ? '#888' : '#e8e8e8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {name}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: '#555', flexShrink: 0, marginLeft: 8 }}>
                    {(() => {
                      try {
                        return formatDistanceToNow(new Date(email.date), { addSuffix: true });
                      } catch {
                        return '';
                      }
                    })()}
                  </span>
                </div>

                {/* Subject */}
                <div style={{
                  fontSize: 13,
                  color: email.isRead ? '#666' : '#ccc',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: 4,
                }}>
                  {email.subject || '(no subject)'}
                </div>

                {/* Snippet */}
                <div style={{
                  fontSize: 12,
                  color: '#444',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {email.snippet}
                </div>

                {/* Provider badge */}
                <div style={{ marginTop: 6 }}>
                  <span style={{
                    fontSize: 10,
                    color: email.provider === 'gmail' ? '#ea433566' : '#0078d466',
                    background: email.provider === 'gmail' ? 'rgba(234,67,53,0.08)' : 'rgba(0,120,212,0.08)',
                    padding: '1px 6px',
                    borderRadius: 10,
                  }}>
                    {email.provider}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
