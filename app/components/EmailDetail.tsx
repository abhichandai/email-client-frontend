'use client';

import { useState, useEffect, useRef } from 'react';
import { Email } from '../types';
import { useAccounts } from '../context/accounts';

interface EmailDetailProps {
  email: Email | null;
  onReply: (email: Email) => void;
  onClose: () => void;
  isMobile?: boolean;
  onEmailUpdate?: (updated: Partial<Email> & { id: string }) => void;
  onBulkUpdate?: (emails: Email[]) => void;
  accessToken?: string;
}

const PRIORITY_OPTIONS = [
  { value: 'HIGH', label: 'Priority', color: '#e05c5c' },
  { value: 'MEDIUM', label: 'Important', color: '#d4a853' },
  { value: 'LOW', label: 'Low', color: '#666' },
];

function EmailBodyFrame({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><style>
      body { margin: 0; padding: 0; font-family: -apple-system, sans-serif; font-size: 14px;
             line-height: 1.6; color: #ccc; background: transparent; word-wrap: break-word; }
      a { color: #d4a853; }
      img { max-width: 100%; height: auto; }
      blockquote { border-left: 2px solid #333; margin: 8px 0; padding-left: 12px; color: #666; }
      pre, code { background: #111; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
    </style></head><body>${html}</body></html>`);
    doc.close();
    const resize = () => {
      if (iframe.contentDocument?.body) {
        setHeight(iframe.contentDocument.body.scrollHeight + 24);
      }
    };
    setTimeout(resize, 100);
    iframe.addEventListener('load', resize);
    return () => iframe.removeEventListener('load', resize);
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      style={{ width: '100%', height, border: 'none', display: 'block', background: 'transparent' }}
      sandbox="allow-same-origin"
      title="email body"
    />
  );
}

function SingleEmail({
  email,
  isExpanded,
  onToggle,
  accessToken,
  onEmailUpdate,
  onReply,
  showPriorityControls,
}: {
  email: Email;
  isExpanded: boolean;
  onToggle: () => void;
  accessToken?: string;
  onEmailUpdate?: (updated: Partial<Email> & { id: string }) => void;
  onReply: (email: Email) => void;
  showPriorityControls?: boolean;
}) {
  const [body, setBody] = useState(email.body || '');
  const [bodyHtml, setBodyHtml] = useState(email.bodyHtml || '');
  const [loadingBody, setLoadingBody] = useState(false);

  useEffect(() => {
    if (!isExpanded || body || bodyHtml || !accessToken) return;
    setLoadingBody(true);
    fetch('/api/email/body', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: email.id, accessToken }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.body) setBody(data.body);
        if (data.bodyHtml) setBodyHtml(data.bodyHtml);
        if (data.body || data.bodyHtml) {
          onEmailUpdate?.({ id: email.id, body: data.body, bodyHtml: data.bodyHtml });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingBody(false));
  }, [isExpanded, email.id, accessToken, body, bodyHtml, onEmailUpdate]);

  const senderName = email.from?.replace(/<.*>/, '').trim().replace(/^"|"$/g, '') || 'Unknown';
  const senderEmail = email.from?.match(/<(.+)>/)?.[1] || email.from || '';
  const timestamp = email.date
    ? new Date(email.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
      {/* Header row — always visible, click to expand/collapse */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', background: isExpanded ? 'var(--bg-2)' : 'var(--bg-3)',
          textAlign: 'left',
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: 'rgba(212,168,83,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#d4a853', fontSize: 13, fontWeight: 600, flexShrink: 0,
        }}>
          {senderName[0]?.toUpperCase() || '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{senderName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{senderEmail}</div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{timestamp}</div>
        <span style={{ fontSize: 10, color: '#555', marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</span>
      </button>

      {/* Body — visible when expanded */}
      {isExpanded && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
          {loadingBody ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0' }}>Loading email...</div>
          ) : bodyHtml ? (
            <EmailBodyFrame html={bodyHtml} />
          ) : body ? (
            <pre style={{ fontSize: 13, lineHeight: 1.7, color: '#ccc', whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
              {body}
            </pre>
          ) : (
            <p style={{ fontSize: 13, color: '#555', fontStyle: 'italic' }}>{email.snippet || 'No content available.'}</p>
          )}

          {/* Reply button */}
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button onClick={() => onReply(email)} style={{
              padding: '6px 16px', background: '#d4a853', color: '#0a0a0a',
              borderRadius: 6, fontSize: 12, fontWeight: 500,
            }}>Reply</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmailDetail({
  email, onReply, onClose, isMobile, onEmailUpdate, onBulkUpdate, accessToken,
}: EmailDetailProps) {
  const { accounts } = useAccounts();
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [savingPriority, setSavingPriority] = useState(false);
  const [localPriority, setLocalPriority] = useState<string | null>(null);
  const [localIsRead, setLocalIsRead] = useState<boolean | null>(null);
  // Track which thread email is expanded (by id). Default: open the latest (first).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // When the selected email changes, reset expanded state to open only the latest
  useEffect(() => {
    if (email) {
      const threads = email.threadEmails || [email];
      setExpandedIds(new Set([threads[0].id]));
      setLocalPriority(null);
      setLocalIsRead(null);
    }
  }, [email?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const token = accessToken || accounts[0]?.tokens?.access_token;
  const senderEmail = email.from?.match(/<(.+)>/)?.[1] || email.from || '';
  const senderName = email.from?.replace(/<.*>/, '').trim().replace(/^"|"$/g, '') || 'Unknown';
  const threadEmails = email.threadEmails || [email];

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
      body: JSON.stringify({ emailId: email.id, isRead: newIsRead, accessToken: token }),
    });
    onEmailUpdate?.({ id: email.id, isRead: newIsRead });
  };

  const toggleThread = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
              background: 'var(--bg-2)', border: `1px solid ${priorityConfig.color}40`,
              borderRadius: 6, color: priorityConfig.color, fontSize: 12, fontWeight: 500,
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
                <button key={opt.value} onClick={() => setPriority(opt.value, false)}
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
                <button key={opt.value + '-rule'} onClick={() => setPriority(opt.value, true)}
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

        {/* Thread count badge */}
        {threadEmails.length > 1 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-3)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 10 }}>
            {threadEmails.length} messages
          </span>
        )}
      </div>

      {/* Subject */}
      <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, fontFamily: 'Instrument Serif, serif', margin: 0 }}>
          {email.subject || '(no subject)'}
        </h2>
        {email.reason && (
          <div style={{
            marginTop: 10, padding: '8px 12px',
            background: `${priorityConfig.color}10`, border: `1px solid ${priorityConfig.color}25`,
            borderRadius: 6, fontSize: 12, color: priorityConfig.color,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>⚡</span><span>{email.reason}</span>
          </div>
        )}
      </div>

      {/* Thread emails */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {threadEmails.map((threadEmail, idx) => (
          <SingleEmail
            key={threadEmail.id}
            email={threadEmail}
            isExpanded={expandedIds.has(threadEmail.id)}
            onToggle={() => toggleThread(threadEmail.id)}
            accessToken={token}
            onEmailUpdate={onEmailUpdate}
            onReply={onReply}
            showPriorityControls={idx === 0}
          />
        ))}
      </div>
    </div>
  );
}
