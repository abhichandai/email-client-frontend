'use client';

import { useState } from 'react';
import { Account } from '../context/accounts';
import { Email } from '../types';

interface ComposeModalProps {
  accounts: Account[];
  replyTo: Email | null;
  onClose: () => void;
  apiUrl: string;
}

export default function ComposeModal({ accounts, replyTo, onClose, apiUrl }: ComposeModalProps) {
  const [from, setFrom] = useState(accounts[0]?.id || '');
  const [to, setTo] = useState(replyTo ? replyTo.from.match(/<(.+)>/)?.[1] || replyTo.from : '');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === from);

  const handleSend = async () => {
    if (!selectedAccount || !to || !body) return;
    setSending(true);
    try {
      await fetch(`${apiUrl}/emails/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedAccount.provider,
          tokens: selectedAccount.tokens,
          to,
          subject,
          body,
          threadId: replyTo?.threadId,
        }),
      });
      setSent(true);
      setTimeout(onClose, 1200);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'flex-end',
      padding: 24,
      zIndex: 100,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: 520,
        background: '#141414',
        border: '1px solid #2a2a2a',
        borderRadius: 12,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          background: '#1a1a1a',
          borderBottom: '1px solid #222',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, color: '#888' }}>
            {replyTo ? 'Reply' : 'New Message'}
          </span>
          <button onClick={onClose} style={{ color: '#555', fontSize: 18 }}>×</button>
        </div>

        <div style={{ padding: '0' }}>
          {/* From */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid #1e1e1e', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#555', width: 50 }}>From</span>
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ flex: 1, background: 'transparent', color: '#ccc', border: 'none', fontSize: 13, outline: 'none' }}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id} style={{ background: '#1a1a1a' }}>
                  {a.email} ({a.provider})
                </option>
              ))}
            </select>
          </div>

          {/* To */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid #1e1e1e', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#555', width: 50 }}>To</span>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@email.com"
              style={{ flex: 1, background: 'transparent', color: '#e8e8e8', border: 'none', fontSize: 13, outline: 'none' }}
            />
          </div>

          {/* Subject */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid #1e1e1e', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#555', width: 50 }}>Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              style={{ flex: 1, background: 'transparent', color: '#e8e8e8', border: 'none', fontSize: 13, outline: 'none' }}
            />
          </div>

          {/* Body */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            style={{
              width: '100%',
              minHeight: 200,
              background: 'transparent',
              color: '#ccc',
              border: 'none',
              fontSize: 14,
              outline: 'none',
              padding: '16px 20px',
              resize: 'vertical',
              fontFamily: 'DM Sans, sans-serif',
              lineHeight: 1.7,
            }}
          />
        </div>

        {/* Actions */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #1e1e1e',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <button
            onClick={handleSend}
            disabled={sending || sent || !to || !body}
            style={{
              padding: '8px 24px',
              background: sent ? '#2d5a27' : '#d4a853',
              color: sent ? '#7cba6f' : '#0a0a0a',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              opacity: (!to || !body || sending) ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
          >
            {sent ? '✓ Sent' : sending ? 'Sending...' : 'Send'}
          </button>
          <button
            onClick={onClose}
            style={{ fontSize: 13, color: '#555', padding: '8px 12px' }}
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
