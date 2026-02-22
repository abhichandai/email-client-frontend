'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../context/theme';

interface PriorityRules {
  importantSenders: string[];
  importantDomains: string[];
  importantKeywords: string[];
  unimportantSenders: string[];
}

const DEFAULT_KEYWORDS = [
  'invoice', 'payment', 'contract', 'agreement', 'receipt',
  'deadline', 'urgent', 'action required', 'wire transfer',
  'legal', 'offer letter', 'sign', 'NDA',
];

function Section({ title, children }: { title: string; children: import('react').ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 10, marginBottom: 24, overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.8px',
      }}>{title}</div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
}

function TagList({ items, onRemove }: { items: string[]; onRemove: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {items.map(item => (
        <span key={item} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', background: 'var(--bg-3)',
          border: '1px solid var(--border)', borderRadius: 20,
          fontSize: 12, color: 'var(--text)',
        }}>
          {item}
          <button onClick={() => onRemove(item)} style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1, marginTop: -1 }}>×</button>
        </span>
      ))}
    </div>
  );
}

function AddInput({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [val, setVal] = useState('');
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { onAdd(val.trim()); setVal(''); } }}
        placeholder={placeholder}
        style={{
          flex: 1, padding: '8px 12px', background: 'var(--bg-3)', color: 'var(--text)',
          border: '1px solid var(--border)', borderRadius: 6, fontSize: 13,
        }}
      />
      <button
        onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(''); } }}
        style={{
          padding: '8px 16px', background: 'var(--accent)', color: '#0a0a0a',
          borderRadius: 6, fontSize: 13, fontWeight: 600,
        }}
      >Add</button>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { preference, setPreference } = useTheme();

  const [signature, setSignature] = useState('');
  const [sigSaving, setSigSaving] = useState(false);
  const [sigSaved, setSigSaved] = useState(false);

  const [rules, setRules] = useState<PriorityRules>({
    importantSenders: [], importantDomains: [],
    importantKeywords: [], unimportantSenders: [],
  });
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rulesSaved, setRulesSaved] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') router.push('/'); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router]);

  useEffect(() => {
    fetch('/api/preferences').then(r => r.json()).then(d => {
      if (d.signature !== undefined) setSignature(d.signature);
    }).catch(() => {});

    fetch('/api/rules').then(r => r.json()).then(d => {
      if (d) setRules({
        importantSenders: d.important_senders || [],
        importantDomains: d.important_domains || [],
        importantKeywords: d.important_keywords || [],
        unimportantSenders: d.unimportant_senders || [],
      });
    }).catch(() => {});
  }, []);

  const saveSignature = async () => {
    setSigSaving(true);
    await fetch('/api/preferences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature }),
    });
    setSigSaving(false); setSigSaved(true);
    setTimeout(() => setSigSaved(false), 2000);
  };

  const saveRules = async (updated: PriorityRules) => {
    setRules(updated);
    setRulesSaving(true);
    await fetch('/api/rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        important_senders: updated.importantSenders,
        important_domains: updated.importantDomains,
        important_keywords: updated.importantKeywords,
        unimportant_senders: updated.unimportantSenders,
      }),
    });
    setRulesSaving(false); setRulesSaved(true);
    setTimeout(() => setRulesSaved(false), 2000);
  };

  const addRule = (type: keyof PriorityRules, val: string) => {
    if (!val || rules[type].includes(val)) return;
    saveRules({ ...rules, [type]: [...rules[type], val] });
  };

  const removeRule = (type: keyof PriorityRules, val: string) => {
    saveRules({ ...rules, [type]: rules[type].filter(x => x !== val) });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        padding: '20px 40px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-2)', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button
          onClick={() => router.push('/')}
          style={{ color: 'var(--text-muted)', fontSize: 20, lineHeight: 1 }}
          onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >←</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>Settings</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Manage your preferences and priority rules</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 640, margin: '32px auto', padding: '0 24px 60px' }}>

        {/* Signature */}
        <Section title="Email Signature">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Appended to every email you send.
          </div>
          <textarea
            value={signature}
            onChange={e => { setSignature(e.target.value); setSigSaved(false); }}
            placeholder={'Your Name\nyour@email.com'}
            rows={5}
            style={{
              width: '100%', padding: '10px 12px', fontSize: 13,
              background: 'var(--bg-3)', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 6,
              resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={saveSignature}
            style={{
              marginTop: 10, padding: '8px 20px', fontSize: 13, borderRadius: 6,
              background: sigSaved ? '#2d6a4f22' : 'var(--accent)',
              color: sigSaved ? '#4caf82' : '#0a0a0a',
              border: sigSaved ? '1px solid #2d6a4f44' : 'none',
              fontWeight: 600, transition: 'all 0.2s',
            }}
          >{sigSaving ? 'Saving...' : sigSaved ? '✓ Saved' : 'Save signature'}</button>
        </Section>

        {/* Priority Rules */}
        <Section title="Priority Rules">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Rules apply on the next Gmail sync. {rulesSaving ? 'Saving...' : rulesSaved ? '✓ Saved' : ''}
          </div>

          {[
            { label: 'Important senders', sub: 'Always mark HIGH', type: 'importantSenders' as keyof PriorityRules, placeholder: 'name@company.com', color: 'var(--high)' },
            { label: 'Important domains', sub: 'All emails from this domain → HIGH', type: 'importantDomains' as keyof PriorityRules, placeholder: 'company.com', color: 'var(--high)' },
            { label: 'Ignored senders', sub: 'Always mark LOW', type: 'unimportantSenders' as keyof PriorityRules, placeholder: 'noreply@notifications.com', color: 'var(--text-muted)' },
          ].map(({ label, sub, type, placeholder, color }) => (
            <div key={type} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
              <TagList items={rules[type]} onRemove={v => removeRule(type, v)} />
              <AddInput placeholder={placeholder} onAdd={v => addRule(type, v)} />
            </div>
          ))}

          {/* Keywords */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Important keywords</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Subject lines containing these → HIGH</div>
            <TagList items={rules.importantKeywords} onRemove={v => removeRule('importantKeywords', v)} />
            <AddInput placeholder="invoice, urgent, contract..." onAdd={v => addRule('importantKeywords', v)} />
            {/* Quick-add chips */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Quick add:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {DEFAULT_KEYWORDS.filter(kw => !rules.importantKeywords.includes(kw)).map(kw => (
                  <button key={kw} onClick={() => addRule('importantKeywords', kw)}
                    style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 20,
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      color: 'var(--text-muted)',
                    }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >+ {kw}</button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
            Choose your preferred color scheme.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['light', 'dark', 'system'] as const).map(opt => (
              <button key={opt} onClick={() => setPreference(opt)}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 8, fontSize: 13,
                  background: preference === opt ? 'var(--accent)' : 'var(--bg-3)',
                  color: preference === opt ? '#0a0a0a' : 'var(--text-muted)',
                  fontWeight: preference === opt ? 600 : 400,
                  border: preference === opt ? 'none' : '1px solid var(--border)',
                  transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}
              >
                <span style={{ fontSize: 18 }}>{opt === 'light' ? '☀' : opt === 'dark' ? '☾' : '⊙'}</span>
                <span style={{ fontSize: 12, textTransform: 'capitalize' }}>{opt}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Account */}
        <Section title="Account">
          <button
            onClick={() => { window.location.href = '/onboard'; }}
            style={{
              padding: '9px 18px', borderRadius: 6, fontSize: 13,
              border: '1px solid var(--border)', color: 'var(--text-muted)',
              background: 'transparent', display: 'flex', alignItems: 'center', gap: 8,
            }}
            onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >✦ Redo inbox setup</button>
        </Section>

      </div>
    </div>
  );
}
