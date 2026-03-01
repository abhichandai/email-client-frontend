'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Account } from '../context/accounts';
import { Email } from '../types';

interface Attachment {
  name: string;
  type: string;
  data: string; // base64
  size: number;
}

interface SendPayload {
  to: string;
  subject: string;
  body: string;
  fromEmail: string;
  threadId?: string;
  replyAll?: boolean;
  attachments?: Attachment[];
}

interface ComposeModalProps {
  accounts: Account[];
  replyTo: Email | null;
  onClose: () => void;
  apiUrl: string;
  onSendQueued?: (payload: SendPayload) => void;
}

export default function ComposeModal({ accounts, replyTo, onClose, onSendQueued }: ComposeModalProps) {
  const [to, setTo] = useState(replyTo ? (replyTo.from.match(/<(.+)>/)?.[1] || replyTo.from) : '');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  // Build quoted body immediately from replyTo (no async wait needed)
  const getInitialBody = (reply: Email | null) => {
    if (!reply) return '';
    const suggestedReply = (reply as Email & { _suggestedReply?: string })._suggestedReply;
    if (suggestedReply) return suggestedReply;
    const date = new Date(reply.date || '').toLocaleString();
    const quoted = (reply.snippet || '').split('\n').map((l: string) => '> ' + l).join('\n');
    return '\n\n---\nOn ' + date + ', ' + reply.from + ' wrote:\n' + quoted;
  };

  const [body, setBody] = useState(() => getInitialBody(replyTo));
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [signature, setSignature] = useState('');
  const [modalSize, setModalSize] = useState({ width: 700, height: 560 });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    resizeStart.current = { x: e.clientX, y: e.clientY, w: modalSize.width, h: modalSize.height };
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const newW = Math.max(520, Math.min(resizeStart.current.w + (ev.clientX - resizeStart.current.x), window.innerWidth * 0.95));
      const newH = Math.max(420, Math.min(resizeStart.current.h + (ev.clientY - resizeStart.current.y), window.innerHeight * 0.95));
      setModalSize({ width: newW, height: newH });
    };
    const onUp = () => {
      isResizing.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // AI compose state
  const [showAiBar, setShowAiBar] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');

  const toRef = useRef<HTMLInputElement>(null);

  // Contact autocomplete state
  const [contactSuggestions, setContactSuggestions] = useState<{ email: string; name: string | null; photo_url: string | null; source: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const contactSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const searchContacts = (query: string) => {
    if (contactSearchTimeout.current) clearTimeout(contactSearchTimeout.current);
    if (!query.trim() || query.includes(',')) {
      setContactSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    contactSearchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contacts?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.contacts?.length) {
          setContactSuggestions(data.contacts);
          setShowSuggestions(true);
          setHighlightedIdx(0);
        } else {
          setShowSuggestions(false);
        }
      } catch { setShowSuggestions(false); }
    }, 150);
  };

  const selectContact = (contact: { email: string; name: string | null }) => {
    const formatted = contact.name ? `${contact.name} <${contact.email}>` : contact.email;
    // Support comma-separated multiple recipients
    const parts = to.split(',');
    parts[parts.length - 1] = formatted;
    setTo(parts.join(', ') + ', ');
    setShowSuggestions(false);
    setContactSuggestions([]);
    toRef.current?.focus();
  };

  const handleToKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIdx((i: number) => Math.min(i + 1, contactSuggestions.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIdx((i: number) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (contactSuggestions[highlightedIdx]) selectContact(contactSuggestions[highlightedIdx]);
    }
    if (e.key === 'Escape') { setShowSuggestions(false); }
  };
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

  const account = accounts[0];

  useEffect(() => {
    setTimeout(() => {
      if (replyTo) {
        bodyRef.current?.focus();
        bodyRef.current?.setSelectionRange(0, 0);
        if (bodyRef.current) bodyRef.current.scrollTop = 0;
      } else {
        toRef.current?.focus();
      }
    }, 60);
  }, [replyTo]);

  // Load signature only — quoted body is already set synchronously above
  useEffect(() => {
    fetch('/api/preferences').then(r => r.json()).then(d => {
      const sig = d.signature || '';
      setSignature(sig);
      if (!sig) return;
      if (!replyTo) {
        // New email: pre-fill with signature
        setBody('\n\n-- \n' + sig);
      } else {
        // Reply: prepend signature before the quoted block, keep cursor at top
        setBody(prev => '\n\n-- \n' + sig + '\n' + prev.trimStart());
      }
      // Reposition cursor to top after signature is inserted
      requestAnimationFrame(() => {
        if (bodyRef.current) {
          bodyRef.current.focus();
          bodyRef.current.setSelectionRange(0, 0);
          bodyRef.current.scrollTop = 0;
        }
      });
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showAiBar) {
      setTimeout(() => aiInputRef.current?.focus(), 60);
    }
  }, [showAiBar]);

  const isDirty = () => subject.trim().length > 0 || body.trim().length > 0;

  const handleClose = () => {
    if (isDirty()) {
      if (!window.confirm('Discard this email? Your draft will be lost.')) return;
    }
    onClose();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAiBar) { setShowAiBar(false); return; }
        handleClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSend();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [to, subject, body, showAiBar]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (data.body) setBody(data.body + (signature ? '\n\n-- \n' + signature : ''));
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

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setAttachments(prev => [...prev, { name: file.name, type: file.type, data: base64, size: file.size }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const formatBytes = (bytes: number) => bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)}KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)}MB`;

  const handleSend = async () => {
    if (!account || !to.trim() || !body.trim() || sending) return;
    const payload: SendPayload = {
      to: to.trim(),
      subject: subject.trim() || '(no subject)',
      body: body.trim(),
      fromEmail: account.email,
      threadId: replyTo?.threadId,
      replyAll: (replyTo as Email & { replyAll?: boolean })?.replyAll,
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    if (onSendQueued) {
      onSendQueued(payload);
      onClose();
    } else {
      // Fallback: send immediately (no undo)
      setSending(true);
      setError('');
      try {
        const res = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Send failed');
        setSent(true);
        setTimeout(onClose, 1000);
      } catch (e) {
        setError(String(e));
        setSending(false);
      }
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
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div ref={modalRef} style={{
        width: modalSize.width, height: modalSize.height,
        maxWidth: '96vw', maxHeight: '96vh',
        background: 'var(--compose-bg)',
        borderRadius: 12,
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'composeIn 0.18s ease',
        position: 'relative',
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
          <button onClick={handleClose} style={{ color: 'var(--text-muted)', fontSize: 20, lineHeight: 1, opacity: 0.5 }}
            onMouseOver={e => (e.currentTarget.style.opacity = '1')}
            onMouseOut={e => (e.currentTarget.style.opacity = '0.5')}
          >×</button>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>From</span>
            <span style={{ fontSize: 13, color: 'var(--text)', opacity: 0.7 }}>{account?.email}</span>
          </div>
          <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>To</span>
            <input
              ref={toRef} value={to}
              onChange={e => { setTo(e.target.value); searchContacts(e.target.value.split(',').pop()?.trim() || ''); }}
              onKeyDown={handleToKeyDown}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => { if (to.trim()) searchContacts(to.split(',').pop()?.trim() || ''); }}
              placeholder="recipient@email.com"
              style={{ flex: 1, background: 'transparent', color: 'var(--text)', border: 'none', fontSize: 13, outline: 'none' }}
              autoComplete="off"
            />
            {/* Autocomplete dropdown */}
            {showSuggestions && contactSuggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: 8, boxShadow: '0 8px 32px var(--shadow)',
                  overflow: 'hidden',
                }}
              >
                {contactSuggestions.map((c, i) => (
                  <div
                    key={c.email}
                    onMouseDown={() => selectContact(c)}
                    style={{
                      padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer',
                      background: i === highlightedIdx ? 'var(--accent-dim)' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={() => setHighlightedIdx(i)}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: c.photo_url ? 'transparent' : 'rgba(212,168,83,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      {c.photo_url
                        ? <img src={c.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        : <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                            {(c.name || c.email)[0].toUpperCase()}
                          </span>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {c.name && (
                        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.name}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.email}
                      </div>
                    </div>
                    {c.source === 'google_contacts' && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.5, flexShrink: 0 }}>contacts</span>
                    )}
                  </div>
                ))}
              </div>
            )}
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
              width: '100%', flex: 1, minHeight: 200,
              background: 'transparent',
              color: 'var(--text)', border: 'none', fontSize: 14,
              outline: 'none', padding: '16px 24px',
              resize: 'none', fontFamily: 'DM Sans, sans-serif',
              lineHeight: 1.75, boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div style={{ padding: '8px 24px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {attachments.map((att, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 20,
                  background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.25)',
                  fontSize: 12, color: 'var(--text)',
                }}>
                  <span>📎</span>
                  <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{formatBytes(att.size)}</span>
                  <button
                    onClick={() => removeAttachment(i)}
                    style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1, marginLeft: 2 }}
                    onMouseOver={e => (e.currentTarget.style.color = '#e05c5c')}
                    onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
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

          {/* Attachment button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
            onClick={e => { (e.target as HTMLInputElement).value = ''; }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Attach files"
            style={{
              marginLeft: error ? 0 : 'auto',
              padding: '6px 10px', borderRadius: 6,
              fontSize: 16,
              border: attachments.length > 0 ? '1px solid rgba(212,168,83,0.4)' : '1px solid transparent',
              color: attachments.length > 0 ? 'var(--accent)' : 'var(--text-muted)',
            }}
            onMouseOver={e => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseOut={e => (e.currentTarget.style.color = attachments.length > 0 ? 'var(--accent)' : 'var(--text-muted)')}
          >📎</button>

          <button
            onClick={handleClose}
            style={{ marginLeft: error ? 0 : 0, fontSize: 12, color: 'var(--text-muted)', padding: '6px 10px', borderRadius: 6 }}
            onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            Discard
          </button>
          </div>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={startResize}
          style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 18, height: 18,
            cursor: 'nwse-resize',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
            padding: '3px',
            opacity: 0.35,
          }}
          onMouseOver={e => (e.currentTarget.style.opacity = '0.7')}
          onMouseOut={e => (e.currentTarget.style.opacity = '0.35')}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="var(--text-muted)">
            <path d="M9 1L1 9M9 5L5 9M9 9" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
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
