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

  // AI compose state
  const [showAiBar, setShowAiBar] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');

  const toRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

  const account = accounts[0];

  useEffect(() => {
    setTimeout(() => {
      if (replyTo) bodyRef.current?.focus();
      else toRef.current?.focus();
    }, 60);
  }, [replyTo]);

  useEffect(() => {
    if (showAiBar) {
      setTimeout(() => aiInputRef.current?.focus(), 60);
    }
  }, [showAiBar]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAiBar) { setShowAiBar(false); return; }
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSend();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [to, body, showAiBar]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAiDraft = async (prompt: string) => {
    if (!prompt.trim() || aiLoading) return;
    setAiLoading(true);
    setAiError('');
    setLastPrompt(prompt);
    try {
      const res = await fetch('/api/ai/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          to,
          subject,
          replyContext: replyTo ? {
            from: replyTo.from,
            subject: replyTo.subject,
            snippet: replyTo.snippet,
            body: replyTo.body,
          } : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Draft failed');
      if (data.body) setBody(data.body);
      if (data.subject && !subject) setSubject(data.subject);
      setShowAiBar(false);
      setAiPrompt('');
      setTimeout(() => bodyRef.current?.focus(), 60);
    } catch (e) {
      setAiError(String(e));
    } finally {
      setAiLoading(false);
    }
  };

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
          <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>From</span>
            <span style={{ fontSize: 13, color: 'var(--text)', opacity: 0.7 }}>{account?.email}</span>
          </div>
          <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>To</span>
            <input
              ref={toRef} value={to} onChange={e => setTo(e.target.value)}
              placeholder="recipient@email.com"
              style={{ flex: 1, background: 'transparent', color: 'var(--text)', border: 'none', fontSize: 13, outline: 'none' }}
            />
          </div>
          <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>Subject</span>
            <input
              value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Subject"
              style={{ flex: 1, background: 'transparent', color: 'var(--text)', border: 'none', fontSize: 13, outline: 'none' }}
            />
          </div>

          {/* AI prompt bar */}
          {showAiBar && (
            <div style={{
              padding: '12px 24px',
              borderBottom: '1px solid var(--border)',
              background: 'rgba(212,168,83,0.04)',
              animation: 'aiBarIn 0.15s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>✦</span>
                <input
                  ref={aiInputRef}
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleAiDraft(aiPrompt); }
                    if (e.key === 'Escape') { e.preventDefault(); setShowAiBar(false); }
                  }}
                  placeholder={replyTo ? 'e.g. "decline politely" or "ask for more details"' : 'e.g. "follow up on the invoice" or "schedule a meeting"'}
                  style={{
                    flex: 1, background: 'transparent', color: 'var(--text)',
                    border: 'none', fontSize: 13, outline: 'none',
                  }}
                />
                <button
                  onClick={() => handleAiDraft(aiPrompt)}
                  disabled={!aiPrompt.trim() || aiLoading}
                  style={{
                    padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: 'var(--accent)', color: '#0a0a0a',
                    opacity: (!aiPrompt.trim() || aiLoading) ? 0.45 : 1,
                    flexShrink: 0, transition: 'opacity 0.15s',
                  }}
                >
                  {aiLoading ? 'Drafting...' : 'Draft'}
                </button>
              </div>
              {aiError && (
                <p style={{ marginTop: 6, fontSize: 11, color: '#e05c5c' }}>{aiError}</p>
              )}
            </div>
          )}

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
          display: 'flex', alignItems: 'center', gap: 10,
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

          {/* AI Draft button */}
          <button
            onClick={() => { setShowAiBar(v => !v); setAiError(''); }}
            style={{
              padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500,
              border: `1px solid ${showAiBar ? 'rgba(212,168,83,0.5)' : 'var(--border)'}`,
              color: showAiBar ? 'var(--accent)' : 'var(--text-muted)',
              background: showAiBar ? 'rgba(212,168,83,0.08)' : 'transparent',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5,
            }}
            onMouseOver={e => { if (!showAiBar) { (e.currentTarget.style.color = 'var(--accent)'); (e.currentTarget.style.borderColor = 'rgba(212,168,83,0.4)'); } }}
            onMouseOut={e => { if (!showAiBar) { (e.currentTarget.style.color = 'var(--text-muted)'); (e.currentTarget.style.borderColor = 'var(--border)'); } }}
          >
            <span style={{ fontSize: 13 }}>✦</span>
            {lastPrompt && !showAiBar ? 'Regenerate' : 'AI Draft'}
          </button>

          {lastPrompt && !showAiBar && (
            <button
              onClick={() => handleAiDraft(lastPrompt)}
              disabled={aiLoading}
              style={{
                padding: '7px 14px', borderRadius: 7, fontSize: 12,
                border: '1px solid var(--border)',
                color: 'var(--text-muted)', background: 'transparent',
                opacity: aiLoading ? 0.45 : 1,
              }}
              title={`Re-draft: "${lastPrompt}"`}
            >
              {aiLoading ? 'Drafting...' : '↺'}
            </button>
          )}

          <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.5, marginLeft: 4 }}>⌘↵ send</span>
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
        @keyframes aiBarIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
