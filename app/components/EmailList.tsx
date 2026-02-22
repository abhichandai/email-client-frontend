'use client';

import { useState, useRef, useEffect } from 'react';
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
  onEmailUpdate?: (updated: Partial<Email> & { id: string }) => void;
  onBulkUpdate?: (emails: Email[]) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: '#e05c5c', MEDIUM: '#d4a853', LOW: 'var(--low)',
};

interface ContextMenu { x: number; y: number; email: Email; }

function SkeletonRow() {
  return (
    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <div className="skeleton" style={{ height: 12, width: '40%' }} />
        <div className="skeleton" style={{ height: 10, width: '15%' }} />
      </div>
      <div className="skeleton" style={{ height: 11, width: '70%', marginBottom: 5 }} />
      <div className="skeleton" style={{ height: 10, width: '55%' }} />
    </div>
  );
}

export default function EmailList({
  emails, loading, selected, onSelect, onRefresh,
  isMobile, onMenuOpen, loadingMore, hasMore, onLoadMore, onEmailUpdate, onBulkUpdate,
}: EmailListProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  // Track which thread is expanded inline in the list
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setContextMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // When selected email changes, expand its thread in sidebar
  useEffect(() => {
    if (selected?.threadId) setExpandedThreadId(selected.threadId);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleContextMenu = (e: React.MouseEvent, email: Email) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, email });
  };

  const setReadState = async (email: Email, isRead: boolean) => {
    setContextMenu(null);
    onEmailUpdate?.({ id: email.id, isRead });
    await fetch('/api/email/read', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: email.id, isRead }),
    });
  };

  const setPriority = async (email: Email, priority: string) => {
    setContextMenu(null);
    onEmailUpdate?.({ id: email.id, priority: priority as 'HIGH' | 'MEDIUM' | 'LOW' });
    await fetch('/api/email/priority', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: email.id, priority, addToRules: false }),
    });
  };

  const handleThreadClick = (email: Email) => {
    if ((email.threadCount ?? 1) > 1) {
      // Toggle inline expansion
      const newExpanded = expandedThreadId === email.threadId ? null : (email.threadId || null);
      setExpandedThreadId(newExpanded);
    }
    onSelect(email);
  };

  return (
    <div style={{ width: isMobile ? '100%' : 360, height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(180deg, rgba(212,168,83,0.03) 0%, transparent 100%)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isMobile && <button onClick={onMenuOpen} style={{ color: 'var(--text-muted)', fontSize: 18, marginRight: 4 }}>☰</button>}
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {loading ? 'Syncing...' : `${emails.length} messages`}
          </span>
        </div>
        <button onClick={onRefresh} title="Refresh"
          style={{ color: 'var(--text-muted)', fontSize: 16, transition: 'color 0.15s' }}
          onMouseOver={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >↺</button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && emails.length === 0 ? (
          // Skeleton loading state
          <>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
          </>
        ) : emails.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>✉</div>
            No emails to show.
          </div>
        ) : (
          <>
            {emails.map((email) => {
              const isSelected = selected?.id === email.id || selected?.threadId === email.threadId;
              const isThreadExpanded = expandedThreadId === email.threadId && (email.threadCount ?? 1) > 1;
              const threadEmails = email.threadEmails || [];

              return (
                <div key={email.id}>
                  {/* Main thread row */}
                  <button
                    onClick={() => handleThreadClick(email)}
                    onContextMenu={(e) => handleContextMenu(e, email)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: isMobile ? '14px 16px' : '12px 20px',
                      borderBottom: isThreadExpanded ? 'none' : '1px solid var(--border)',
                      background: isSelected ? 'var(--accent-dim)' : 'transparent',
                      borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: PRIORITY_COLORS[email.priority] || '#444' }} />
                        <span style={{
                          fontSize: 13, fontWeight: email.isRead ? 400 : 700,
                          color: email.isRead ? 'var(--text-muted)' : 'var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {email.from?.replace(/<.*>/, '').trim() || 'Unknown'}
                        </span>
                        {(email.threadCount ?? 1) > 1 && (
                          <span style={{
                            fontSize: 10, color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                            background: 'var(--bg-3)', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                            padding: '1px 5px', borderRadius: 8, flexShrink: 0,
                          }}>
                            {email.threadCount}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                        {formatDate(email.date)}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 12, fontWeight: email.isRead ? 400 : 600,
                      color: email.isRead ? 'var(--text-muted)' : 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3,
                    }}>
                      {email.subject || '(no subject)'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {email.snippet}
                    </div>
                  </button>

                  {/* Inline thread expansion */}
                  {isThreadExpanded && threadEmails.length > 0 && (
                    <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                      {threadEmails.map((te, idx) => (
                        <button
                          key={te.id}
                          onClick={() => onSelect(te)}
                          style={{
                            width: '100%', textAlign: 'left',
                            padding: '9px 20px 9px 32px',
                            borderTop: idx === 0 ? '1px solid var(--border)' : 'none',
                            borderBottom: idx < threadEmails.length - 1 ? '1px solid var(--border)' : 'none',
                            background: selected?.id === te.id ? 'var(--accent-dim)' : 'transparent',
                            borderLeft: selected?.id === te.id ? '2px solid var(--accent)' : '2px solid transparent',
                            display: 'flex', gap: 8, alignItems: 'flex-start',
                          }}
                          onMouseOver={e => { if (selected?.id !== te.id) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                          onMouseOut={e => { if (selected?.id !== te.id) e.currentTarget.style.background = selected?.id === te.id ? 'var(--accent-dim)' : 'transparent'; }}
                        >
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: PRIORITY_COLORS[te.priority] || '#444', marginTop: 4, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                              <span style={{ fontSize: 12, fontWeight: te.isRead ? 400 : 600, color: te.isRead ? 'var(--text-muted)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {te.from?.replace(/<.*>/, '').trim() || 'Unknown'}
                              </span>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                                {formatDate(te.date)}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {te.snippet}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {hasMore && (
              <div style={{ padding: '16px 20px', textAlign: 'center' }}>
                <button onClick={onLoadMore} disabled={loadingMore} style={{
                  padding: '8px 20px', background: 'var(--bg-3)',
                  color: loadingMore ? 'var(--text-muted)' : 'var(--accent)',
                  border: '1px solid var(--border)', borderRadius: 6, fontSize: 12,
                  cursor: loadingMore ? 'not-allowed' : 'pointer',
                }}>
                  {loadingMore ? 'Loading...' : 'Load 50 more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <div ref={menuRef} style={{
          position: 'fixed', top: contextMenu.y, left: contextMenu.x,
          background: 'var(--bg-3)', border: '1px solid var(--border)',
          borderRadius: 8, zIndex: 1000, minWidth: 200,
          boxShadow: '0 8px 32px var(--shadow)', overflow: 'hidden',
        }}>
          <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--border)' }}>
            {contextMenu.email.from?.replace(/<.*>/, '').trim()?.split(' ')[0]}
          </div>
          {[
            { label: '● Priority', action: () => setPriority(contextMenu.email, 'HIGH'), color: '#e05c5c' },
            { label: '● Important', action: () => setPriority(contextMenu.email, 'MEDIUM'), color: '#d4a853' },
            { label: '● Low', action: () => setPriority(contextMenu.email, 'LOW'), color: 'var(--text-muted)' },
            null,
            { label: contextMenu.email.isRead ? '◯ Mark unread' : '● Mark read', action: () => setReadState(contextMenu.email, !contextMenu.email.isRead), color: 'var(--text)' },
          ].map((item, i) =>
            item === null ? (
              <div key={i} style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
            ) : (
              <button key={i} onClick={item.action} style={{
                width: '100%', padding: '9px 14px', textAlign: 'left',
                fontSize: 13, color: item.color,
              }}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    if (isToday) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (isYesterday) return 'Yesterday';
    if (now.getFullYear() === d.getFullYear()) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
}
