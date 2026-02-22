'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface OnboardEmail {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  isRead: boolean;
  threadId: string;
  priority: string;
  reason: string;
}

const PRIORITY_LABELS: Record<string, { label: string; color: string; dot: string; desc: string }> = {
  HIGH:      { label: 'Priority',  color: '#e05c5c', dot: '#e05c5c', desc: 'Never miss these' },
  MEDIUM:    { label: 'Important', color: '#d4a853', dot: '#d4a853', desc: 'Good to know' },
  LOW:       { label: 'Low',       color: '#666',    dot: '#666',    desc: 'When you have time' },
  MARKETING: { label: 'Marketing', color: '#555',    dot: '#555',    desc: 'Noise to filter out' },
};

function parseSender(from: string) {
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].replace(/^["']|["']$/g, '').trim(), email: match[2] };
  return { name: from, email: from };
}

function EmailRow({
  email, onChangePriority,
}: {
  email: OnboardEmail;
  onChangePriority: (id: string, priority: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { name } = parseSender(email.from);
  const meta = PRIORITY_LABELS[email.priority] || PRIORITY_LABELS.MEDIUM;
  const priorities = ['HIGH', 'MEDIUM', 'LOW', 'MARKETING'];

  return (
    <div style={{
      padding: '10px 16px',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'transparent',
      transition: 'background 0.1s',
    }}
      onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
      onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Dot */}
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.dot, flexShrink: 0 }} />

      {/* Sender + subject */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
            {name}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
            {email.subject || '(no subject)'}
          </span>
        </div>
        {email.reason && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, opacity: 0.7 }}>
            {email.reason}
          </div>
        )}
      </div>

      {/* Priority picker */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600,
            border: `1px solid ${meta.color}`,
            color: meta.color, background: `${meta.color}18`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {meta.label} <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
        </button>
        {open && (
          <div style={{
            position: 'absolute', right: 0, top: '110%', zIndex: 50,
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 24px var(--shadow)',
            minWidth: 140,
          }}>
            {priorities.map(p => {
              const m = PRIORITY_LABELS[p];
              return (
                <button
                  key={p}
                  onClick={() => { onChangePriority(email.id, p); setOpen(false); }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '9px 14px',
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: p === email.priority ? `${m.color}18` : 'transparent',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = `${m.color}18`)}
                  onMouseOut={e => (e.currentTarget.style.background = p === email.priority ? `${m.color}18` : 'transparent')}
                >
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: m.color }}>{m.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.desc}</div>
                  </div>
                  {p === email.priority && <span style={{ marginLeft: 'auto', color: m.color, fontSize: 12 }}>✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardPage() {
  const router = useRouter();
  const [stage, setStage] = useState<'loading' | 'review' | 'saving' | 'done'>('loading');
  const [emails, setEmails] = useState<OnboardEmail[]>([]);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'HIGH' | 'MEDIUM' | 'LOW' | 'MARKETING'>('HIGH');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate progress bar during loading
    const interval = setInterval(() => {
      setProgress(p => p < 85 ? p + Math.random() * 8 : p);
    }, 600);

    fetch('/api/onboard')
      .then(r => r.json())
      .then(data => {
        clearInterval(interval);
        if (data.error) { setError(data.error); return; }
        setEmails(data.emails || []);
        setProgress(100);
        setTimeout(() => setStage('review'), 400);
      })
      .catch(e => { clearInterval(interval); setError(String(e)); });

    return () => clearInterval(interval);
  }, []);

  const changePriority = (id: string, priority: string) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, priority } : e));
  };

  const handleFinish = async () => {
    setStage('saving');
    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStage('done');
      setTimeout(() => router.push('/'), 1200);
    } catch (e) {
      setError(String(e));
      setStage('review');
    }
  };

  const grouped = {
    HIGH: emails.filter(e => e.priority === 'HIGH'),
    MEDIUM: emails.filter(e => e.priority === 'MEDIUM'),
    LOW: emails.filter(e => e.priority === 'LOW'),
    MARKETING: emails.filter(e => e.priority === 'MARKETING'),
  };

  const tabs: { key: 'HIGH' | 'MEDIUM' | 'LOW' | 'MARKETING'; label: string; color: string }[] = [
    { key: 'HIGH',      label: 'Priority',  color: '#e05c5c' },
    { key: 'MEDIUM',    label: 'Important', color: '#d4a853' },
    { key: 'LOW',       label: 'Low',       color: '#666' },
    { key: 'MARKETING', label: 'Marketing', color: '#555' },
  ];

  // Loading state
  if (stage === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', padding: 40,
      }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            mail<span style={{ color: 'var(--accent)' }}>mfer</span>
          </div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>
            Reading your inbox and understanding your world...
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ width: 320, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: 'var(--accent)', borderRadius: 2,
            width: `${progress}%`, transition: 'width 0.5s ease',
          }} />
        </div>

        <div style={{ marginTop: 24, fontSize: 13, color: 'var(--text-muted)', opacity: 0.6 }}>
          Analysing up to 100 emails with Claude AI
        </div>

        {error && (
          <div style={{ marginTop: 24, color: '#e05c5c', fontSize: 13, textAlign: 'center', maxWidth: 400 }}>
            {error}
            <br />
            <button onClick={() => router.push('/')} style={{ marginTop: 12, color: 'var(--accent)', fontSize: 13 }}>
              Skip onboarding →
            </button>
          </div>
        )}
      </div>
    );
  }

  // Done state
  if (stage === 'done') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✦</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
          You're all set.
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Taking you to your inbox...
        </div>
      </div>
    );
  }

  // Review state
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        padding: '28px 40px 0',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-2)',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                Here's what we found in your inbox
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                Claude read your last {emails.length} emails and sorted them. Move anything that looks wrong — this teaches the AI your preferences from day one.
              </div>
            </div>
            <button
              onClick={handleFinish}
              disabled={stage === 'saving'}
              style={{
                padding: '10px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14,
                background: 'var(--accent)', color: '#0a0a0a',
                opacity: stage === 'saving' ? 0.6 : 1,
                flexShrink: 0, marginLeft: 24,
                transition: 'opacity 0.15s',
              }}
            >
              {stage === 'saving' ? 'Saving...' : 'Looks good →'}
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '10px 20px',
                  fontSize: 13, fontWeight: 500,
                  color: activeTab === tab.key ? tab.color : 'var(--text-muted)',
                  borderBottom: activeTab === tab.key ? `2px solid ${tab.color}` : '2px solid transparent',
                  background: 'transparent',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 7,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: tab.color, display: 'inline-block' }} />
                {tab.label}
                <span style={{
                  fontSize: 11, padding: '1px 6px', borderRadius: 10,
                  background: activeTab === tab.key ? `${tab.color}22` : 'var(--border)',
                  color: activeTab === tab.key ? tab.color : 'var(--text-muted)',
                  fontWeight: 600,
                }}>
                  {grouped[tab.key].length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Email list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', paddingTop: 8 }}>
          {(grouped[activeTab as keyof typeof grouped] || []).length === 0 ? (
            <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              No emails in this category
            </div>
          ) : (
            (grouped[activeTab as keyof typeof grouped] || []).map((email: OnboardEmail) => (
              <EmailRow key={email.id} email={email} onChangePriority={changePriority} />
            ))
          )}
        </div>
      </div>

      {/* Footer hint */}
      <div style={{
        padding: '12px 40px', borderTop: '1px solid var(--border)',
        background: 'var(--bg-2)',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Click a priority badge to reassign any email. You can always change this later.
          </span>
          <button
            onClick={() => { router.push('/'); }}
            style={{ fontSize: 12, color: 'var(--text-muted)' }}
            onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            Skip setup →
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          position: 'fixed', bottom: 60, left: '50%', transform: 'translateX(-50%)',
          background: '#e05c5c22', border: '1px solid #e05c5c44', color: '#e05c5c',
          padding: '10px 20px', borderRadius: 8, fontSize: 13,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
