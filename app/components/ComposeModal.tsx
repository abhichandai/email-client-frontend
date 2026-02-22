'use client';

import { useState, useEffect, useRef } from 'react';
import { Account } from '../context/accounts';
import { Email } from '../types';

interface ComposeModalProps {
  accounts: Account[];
  replyTo: Email | null;
  onClose: () => void;
  apiUrl: string;
}

export default function ComposeModal({ accounts, replyTo, onClose }: ComposeModalProps) {
  const [to, setTo] = useState(replyTo ? (replyTo.from.match(/<(.+)>/)?.[1] || replyTo.from) : '');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const toRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const account = accounts[0];

  // Focus: jump to body if reply (to/subject pre-filled), else to field
  useEffect(() => {
    setTimeout(() => {
      if (replyTo) bodyRef.current?.focus();
      else toRef.current?.focus();
    }, 60);
  }, [replyTo]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSend();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [to, body]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async () => {
    if (!account || !to.trim() || !body.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim() || '(no subject)',
          body: body.trim(),
          accessToken: account.tokens?.access_token,
          fromEmail: account.email,
          threadId: replyTo?.threadId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setSent(true);
      setTimeout(onClose, 1000);
    } catch (e) {
      setError(String(e));
      setSending(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 600, maxWidth: '92vw',
        background: 'var(--compose-bg)',
        borderRadius: 12,
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'composeIn 0.18s ease',
      }}>
        {/* Title */}
        <div style={{
          padding: '18px 24px 12px',
          fontSize: 15, fontWeight: 500, color: 'var(--text)',
          fontFamily: 'Instrument Serif, serif',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{replyTo ? 'Reply' : 'New Message'}</span>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: 20, lineHeight: 1, opacity: 0.5 }}
            onMouseOver={e => (e.currentTarget.style.opacity = '1')}
            onMouseOut={e => (e.currentTarget.style.opacity = '0.5')}
          >×</button>
        </div>

        {/* Fields */}
        <div>
          {/* From (read-only) */}
          <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>From</span>
            <span style={{ fontSize: 13, color: 'var(--text)', opacity: 0.7 }}>{account?.email}</span>
          </div>

          {/* To */}
          <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>To</span>
            <input
              ref={toRef}
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="recipient@email.com"
              style={{
                flex: 1, background: 'transparent', color: 'var(--text)',
                border: 'none', fontSize: 13, outline: 'none',
              }}
            />
          </div>

          {/* Subject */}
          <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>Subject</span>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject"
              style={{
                flex: 1, background: 'transparent', color: 'var(--text)',
                border: 'none', fontSize: 13, outline: 'none',
              }}
            />
          </div>

          {/* Body */}
          <textarea
            ref={bodyRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={replyTo ? 'Write your reply...' : 'Write your message...'}
            style={{
              width: '100%', minHeight: 220, background: 'transparent',
              color: 'var(--text)', border: 'none', fontSize: 14,
              outline: 'none', padding: '16px 24px',
              resize: 'none', fontFamily: 'DM Sans, sans-serif',
              lineHeight: 1.75,
            }}
          />
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={handleSend}
            disabled={sending || sent || !to.trim() || !body.trim()}
            style={{
              padding: '8px 22px',
              background: sent ? 'rgba(76,175,130,0.2)' : 'var(--accent)',
              color: sent ? '#4caf82' : '#0a0a0a',
              borderRadius: 7, fontSize: 13, fontWeight: 600,
              opacity: (!to.trim() || !body.trim() || sending) ? 0.45 : 1,
              transition: 'all 0.2s',
              border: sent ? '1px solid rgba(76,175,130,0.3)' : 'none',
            }}
          >
            {sent ? '✓ Sent' : sending ? 'Sending...' : 'Send'}
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.5 }}>⌘↵ to send · Esc to close</span>
          {error && <span style={{ fontSize: 12, color: '#e05c5c', marginLeft: 'auto' }}>{error}</span>}
          <button
            onClick={onClose}
            style={{ marginLeft: error ? 0 : 'auto', fontSize: 12, color: 'var(--text-muted)', padding: '6px 10px', borderRadius: 6 }}
            onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            Discard
          </button>
        </div>
      </div>

      <style>{`
        @keyframes composeIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
