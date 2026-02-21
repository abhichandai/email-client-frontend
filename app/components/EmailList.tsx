'use client';

import { Email } from '../types';

interface EmailListProps {
  emails: Email[];
  loading: boolean;
  selected: Email | null;
  onSelect: (email: Email) => void;
  onRefresh: () => void;
  isMobile?: boolean;
  onMenuOpen?: () => void;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: '#e05c5c',
  MEDIUM: '#d4a853',
  LOW: '#444',
};

export default function EmailList({
  emails, loading, selected, onSelect, onRefresh,
  isMobile, onMenuOpen, loadingMore, hasMore, onLoadMore,
}: EmailListProps) {
  return (
    <div style={{
      width: isMobile ? '100%' : 360,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid var(--border)',
      background: 'var(--bg)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(180deg, rgba(212,168,83,0.03) 0%, transparent 100%)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isMobile && (
            <button onClick={onMenuOpen} style={{ color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, marginRight: 4 }}>☰</button>
          )}
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {loading ? 'Loading...' : `${emails.length} messages`}
          </span>
        </div>
        <button
          onClick={onRefresh}
          title="Refresh"
          style={{ color: 'var(--text-muted)', fontSize: 16, transition: 'color 0.15s' }}
          onMouseOver={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >↺</button>
      </div>

      {/* Email list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✉</div>
            Fetching & prioritizing emails...
          </div>
        ) : emails.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✉</div>
            No emails to show.<br />
            <span style={{ fontSize: 12 }}>Connect an account to get started.</span>
          </div>
        ) : (
          <>
            {emails.map((email) => (
              <button
                key={email.id}
                onClick={() => onSelect(email)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: isMobile ? '14px 16px' : '12px 20px',
                  borderBottom: '1px solid var(--border)',
                  background: selected?.id === email.id ? 'rgba(212,168,83,0.06)' : 'transparent',
                  borderLeft: selected?.id === email.id ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'background 0.1s',
                  display: 'block',
                }}
                onMouseOver={e => { if (selected?.id !== email.id) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                onMouseOut={e => { if (selected?.id !== email.id) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Top row: sender + time */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: PRIORITY_COLORS[email.priority] || '#444',
                    }} title={email.priority} />
                    <span style={{
                      fontSize: 13,
                      fontWeight: email.isRead ? 400 : 600,
                      color: email.isRead ? 'var(--text-muted)' : 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {email.from?.replace(/<.*>/, '').trim() || 'Unknown'}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                    {formatDate(email.date)}
                  </span>
                </div>

                {/* Subject */}
                <div style={{
                  fontSize: 12,
                  fontWeight: email.isRead ? 400 : 500,
                  color: email.isRead ? '#666' : '#ccc',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginBottom: 3,
                }}>
                  {email.subject || '(no subject)'}
                </div>

                {/* Snippet */}
                <div style={{
                  fontSize: 11, color: '#444',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {email.snippet}
                </div>
              </button>
            ))}

            {/* Load More */}
            {hasMore && (
              <div style={{ padding: '16px 20px', textAlign: 'center' }}>
                <button
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  style={{
                    padding: '8px 20px',
                    background: 'var(--bg-3)',
                    color: loadingMore ? 'var(--text-muted)' : 'var(--accent)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: loadingMore ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loadingMore ? 'Loading...' : 'Load 50 more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = diff / (1000 * 60 * 60);
    if (hours < 24) return `about ${Math.round(hours)} hour${Math.round(hours) !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}
