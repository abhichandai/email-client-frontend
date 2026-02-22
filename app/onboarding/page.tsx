'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type EmailItem = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  priority: string;
  reason: string;
  finalPriority?: string;
};

type Grouped = { HIGH: EmailItem[]; MEDIUM: EmailItem[]; LOW: EmailItem[] };

const CATEGORY_META = {
  HIGH: {
    label: 'Priority',
    sublabel: 'Never want to miss',
    color: '#e05c5c',
    bg: 'rgba(224,92,92,0.08)',
    border: 'rgba(224,92,92,0.2)',
  },
  MEDIUM: {
    label: 'Important',
    sublabel: 'Need to know, not urgent',
    color: '#d4a853',
    bg: 'rgba(212,168,83,0.08)',
    border: 'rgba(212,168,83,0.2)',
  },
  LOW: {
    label: 'Low',
    sublabel: 'Nice to see, not up front',
    color: '#888',
    bg: 'rgba(136,136,136,0.06)',
    border: 'rgba(136,136,136,0.15)',
  },
};

function parseFrom(from: string) {
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].replace(/^["']|["']$/g, '').trim(), email: match[2] };
  return { name: from, email: from };
}

function EmailCard({
  email,
  currentCategory,
  onMove,
}: {
  email: EmailItem;
  currentCategory: 'HIGH' | 'MEDIUM' | 'LOW';
  onMove: (id: string, to: string) => void;
}) {
  const { name } = parseFrom(email.from);
  const categories = ['HIGH', 'MEDIUM', 'LOW'] as const;

  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '12px 14px',
      marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {email.subject}
          </div>
          {email.reason && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, opacity: 0.6, lineHeight: 1.4 }}>
              {email.reason}
            </div>
          )}
        </div>
        {/* Move buttons */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginTop: 2 }}>
          {categories.filter(c => c !== currentCategory).map(cat => (
            <button
              key={cat}
              onClick={() => onMove(email.id, cat)}
              title={`Move to ${CATEGORY_META[cat].label}`}
              style={{
                width: 22, height: 22, borderRadius: 4, fontSize: 10, fontWeight: 700,
                border: `1px solid ${CATEGORY_META[cat].border}`,
                color: CATEGORY_META[cat].color,
                background: CATEGORY_META[cat].bg,
              }}
            >
              {cat === 'HIGH' ? '↑' : cat === 'MEDIUM' ? '•' : '↓'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'loading' | 'review' | 'saving'>('loading');
  const [loadingMsg, setLoadingMsg] = useState('Connecting to Gmail...');
  const [grouped, setGrouped] = useState<Grouped>({ HIGH: [], MEDIUM: [], LOW: [] });
  const [allEmails, setAllEmails] = useState<EmailItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    runOnboarding();
  }, []);

  const runOnboarding = async () => {
    try {
      setLoadingMsg('Reading your last 100 emails...');
      await new Promise(r => setTimeout(r, 600));
      setLoadingMsg('Running AI analysis...');

      const res = await fetch('/api/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (!res.ok) throw new Error('Failed to analyse inbox');
      const data = await res.json();

      setLoadingMsg('Organising your inbox...');
      await new Promise(r => setTimeout(r, 400));

      const emails = data.emails.map((e: EmailItem) => ({ ...e, finalPriority: e.priority }));
      setAllEmails(emails);
      setGrouped({
        HIGH: emails.filter((e: EmailItem) => e.finalPriority === 'HIGH'),
        MEDIUM: emails.filter((e: EmailItem) => e.finalPriority === 'MEDIUM'),
        LOW: emails.filter((e: EmailItem) => e.finalPriority === 'LOW' || e.finalPriority === 'MARKETING'),
      });
      setPhase('review');
    } catch (e) {
      setError(String(e));
    }
  };

  const handleMove = (id: string, to: string) => {
    setAllEmails(prev => prev.map(e => e.id === id ? { ...e, finalPriority: to } : e));
    setGrouped(prev => {
      const email = prev.HIGH.find(e => e.id === id) ||
        prev.MEDIUM.find(e => e.id === id) ||
        prev.LOW.find(e => e.id === id);
      if (!email) return prev;
      const updated = { ...email, finalPriority: to };
      return {
        HIGH: to === 'HIGH' ? [...prev.HIGH.filter(e => e.id !== id), updated] : prev.HIGH.filter(e => e.id !== id),
        MEDIUM: to === 'MEDIUM' ? [...prev.MEDIUM.filter(e => e.id !== id), updated] : prev.MEDIUM.filter(e => e.id !== id),
        LOW: to === 'LOW' ? [...prev.LOW.filter(e => e.id !== id), updated] : prev.LOW.filter(e => e.id !== id),
      };
    });
  };

  const handleComplete = async () => {
    setPhase('saving');
    try {
      const emailUpdates = allEmails.map(e => ({
        from: e.from,
        originalPriority: e.priority,
        finalPriority: e.finalPriority || e.priority,
      }));
      await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', emailUpdates }),
      });
      router.push('/');
    } catch {
      setPhase('review');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: "'DM Sans', sans-serif",
    }}>

      {/* Header */}
      <div style={{
        width: '100%',
        padding: '24px 40px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
          mail<span style={{ color: 'var(--accent)' }}>mfer</span>
        </div>
        {phase === 'review' && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {allEmails.length} emails analysed
          </div>
        )}
      </div>

      {/* Loading phase */}
      {phase === 'loading' && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 24,
        }}>
          <div style={{ fontSize: 40 }}>✦</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>
            Setting up your inbox
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{loadingMsg}</div>
          {error && (
            <div style={{ color: '#e05c5c', fontSize: 13, maxWidth: 400, textAlign: 'center' }}>
              {error}
              <br />
              <button onClick={runOnboarding} style={{ marginTop: 12, color: 'var(--accent)', fontSize: 13 }}>
                Try again
              </button>
            </div>
          )}
          <div style={{ width: 200, height: 2, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              background: 'var(--accent)',
              borderRadius: 2,
              animation: 'progressPulse 1.8s ease-in-out infinite',
            }} />
          </div>
        </div>
      )}

      {/* Review phase */}
      {phase === 'review' && (
        <div style={{ width: '100%', maxWidth: 1100, padding: '40px 24px 120px' }}>
          {/* Intro */}
          <div style={{ marginBottom: 36, maxWidth: 600 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
              Here's how your inbox looks
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.65 }}>
              We've read your last {allEmails.length} emails and sorted them by importance.
              Adjust anything that looks wrong — use the arrows on each card to move it.
              You can always fine-tune this later from Priority Rules.
            </p>
          </div>

          {/* Three columns */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20,
            alignItems: 'start',
          }}>
            {(['HIGH', 'MEDIUM', 'LOW'] as const).map(cat => {
              const meta = CATEGORY_META[cat];
              const emails = grouped[cat];
              return (
                <div key={cat} style={{
                  border: `1px solid ${meta.border}`,
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: meta.bg,
                }}>
                  {/* Column header */}
                  <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${meta.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: meta.color }}>{meta.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{meta.sublabel}</div>
                      </div>
                      <div style={{
                        fontSize: 12, fontWeight: 700,
                        background: meta.bg, color: meta.color,
                        border: `1px solid ${meta.border}`,
                        borderRadius: 20, padding: '2px 10px',
                      }}>
                        {emails.length}
                      </div>
                    </div>
                  </div>

                  {/* Email cards */}
                  <div style={{ padding: 10, maxHeight: 520, overflowY: 'auto' }}>
                    {emails.length === 0 ? (
                      <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', opacity: 0.5 }}>
                        No emails here
                      </div>
                    ) : (
                      emails.map((email: EmailItem) => (
                        <EmailCard
                          key={email.id}
                          email={email}
                          currentCategory={cat}
                          onMove={handleMove}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Saving phase */}
      {phase === 'saving' && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 20,
        }}>
          <div style={{ fontSize: 40 }}>✦</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>Saving your preferences...</div>
        </div>
      )}

      {/* Sticky CTA */}
      {phase === 'review' && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--bg)',
          borderTop: '1px solid var(--border)',
          padding: '16px 40px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            You can adjust priorities at any time from the sidebar
          </div>
          <button
            onClick={handleComplete}
            style={{
              padding: '11px 32px',
              background: 'var(--accent)',
              color: '#0a0a0a',
              borderRadius: 8,
              fontSize: 14, fontWeight: 700,
            }}
          >
            Looks good — take me to my inbox →
          </button>
        </div>
      )}

      <style>{`
        @keyframes progressPulse {
          0%   { width: 0%; }
          50%  { width: 85%; }
          100% { width: 100%; }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
      `}</style>
    </div>
  );
}
