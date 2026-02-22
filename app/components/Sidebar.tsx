'use client';

import { useState } from 'react';
import { useAccounts, Account } from '../context/accounts';
import { useTheme } from '../context/theme';
import { createClient } from '../../lib/supabase';

interface PriorityRules {
  importantSenders: string[];
  importantDomains: string[];
  importantKeywords: string[];
  unimportantSenders: string[];
}

interface SidebarProps {
  accounts: Account[];
  filter: string;
  setFilter: (f: string) => void;
  onCompose: () => void;
  emailCounts: Record<string, number>;
  rules: PriorityRules;
  onSaveRules: (rules: PriorityRules) => void;
  onForceRefresh: () => void;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Default keywords that give the "magic" feeling
const DEFAULT_KEYWORDS = [
  'invoice', 'payment', 'contract', 'agreement', 'receipt',
  'deadline', 'urgent', 'action required', 'wire transfer',
  'legal', 'offer letter', 'sign', 'NDA',
];

export default function Sidebar({ filter, setFilter, onCompose, emailCounts, rules, onSaveRules, onForceRefresh }: SidebarProps) {
  const { accounts, removeAccount } = useAccounts();
  const { preference, setPreference } = useTheme();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showImportantSenders, setShowImportantSenders] = useState(true);
  const [showIgnoreSenders, setShowIgnoreSenders] = useState(true);
  const [showKeywords, setShowKeywords] = useState(true);
  const [input, setInput] = useState('');
  const [ruleType, setRuleType] = useState<keyof PriorityRules>('importantSenders');

  const filters: { key: string; label: string; color: string }[] = [
    { key: 'ALL', label: 'All Mail', color: 'var(--text)' },
    { key: 'HIGH', label: 'Priority', color: 'var(--high)' },
    { key: 'MEDIUM', label: 'Important', color: 'var(--med)' },
    { key: 'LOW', label: 'Low', color: 'var(--text-muted)' },
    { key: 'MARKETING', label: '📣 Marketing', color: '#8b7cf8' },
    { key: 'CALENDAR', label: '📅 Calendar', color: '#7ab3d4' },
    { key: 'COMPLETE', label: '✓ Complete', color: '#4caf82' },
  ];

  const addRule = () => {
    const val = input.trim();
    if (!val || rules[ruleType].includes(val)) return;
    onSaveRules({ ...rules, [ruleType]: [...rules[ruleType], val] });
    setInput('');
  };

  const removeRule = (type: keyof PriorityRules, val: string) => {
    onSaveRules({ ...rules, [type]: rules[type].filter(x => x !== val) });
  };

  const addDefaultKeyword = (kw: string) => {
    if (rules.importantKeywords.includes(kw)) return;
    onSaveRules({ ...rules, importantKeywords: [...rules.importantKeywords, kw] });
  };

  const CollapsibleSection = ({
    title, items, type, open, onToggle, emptyHint
  }: {
    title: string; items: string[]; type: keyof PriorityRules;
    open: boolean; onToggle: () => void; emptyHint: string;
  }) => (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '4px 0', fontSize: 11, color: items.length ? 'var(--text)' : 'var(--text-muted)',
          fontWeight: items.length ? 500 : 400,
        }}
      >
        <span>{title} {items.length > 0 && <span style={{ fontSize: 10, background: 'var(--bg)', borderRadius: 8, padding: '1px 5px', marginLeft: 3 }}>{items.length}</span>}</span>
        <span style={{ fontSize: 9, opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 4 }}>
          {items.length === 0 ? (
            <div style={{ fontSize: 10, color: '#555', fontStyle: 'italic', padding: '2px 0' }}>{emptyHint}</div>
          ) : (
            items.map(val => (
              <div key={val} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '3px 6px', background: 'var(--bg-3)', borderRadius: 3, marginBottom: 2,
              }}>
                <span style={{ fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
                <button onClick={() => removeRule(type, val)} style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 4, flexShrink: 0, lineHeight: 1 }}>×</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  return (
    <aside style={{
      width: 220, background: 'var(--bg-2)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', padding: '24px 0',
      flexShrink: 0, height: '100%',
    }}>
      {/* Logo */}
      <div style={{
        padding: '0 20px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(180deg, rgba(212,168,83,0.04) 0%, transparent 100%)',
      }}>
        <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 22, letterSpacing: '-0.3px' }}>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>mail</span><span style={{ color: 'var(--accent)' }}>mfer</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Priority Inbox</div>
      </div>

      {/* Compose + Sync */}
      <div style={{ padding: '16px 16px 8px', display: 'flex', gap: 6 }}>
        <button onClick={onCompose} style={{
          flex: 1, padding: '9px 14px', background: 'var(--accent)', color: '#0a0a0a',
          borderRadius: 6, fontSize: 13, fontWeight: 500, transition: 'opacity 0.15s',
        }}
          onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseOut={e => (e.currentTarget.style.opacity = '1')}
        >+ Compose</button>
        <button onClick={onForceRefresh} title="Sync fresh from Gmail" style={{
          padding: '9px 10px', background: 'var(--bg-3)', color: 'var(--text-muted)',
          border: '1px solid var(--border)', borderRadius: 6, fontSize: 14,
        }}
          onMouseOver={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >↺</button>
      </div>

      {/* Filters */}
      <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
        {filters.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 20px',
            background: filter === f.key ? 'var(--accent-dim)' : 'transparent',
            color: filter === f.key ? f.color : 'var(--text-muted)',
            fontSize: 13, transition: 'all 0.1s',
            borderLeft: filter === f.key ? `2px solid ${f.color}` : '2px solid transparent',
          }}>
            <span>{f.label}</span>
            <span style={{ fontSize: 11, background: 'rgba(128,128,128,0.08)', padding: '1px 6px', borderRadius: 10 }}>
              {emailCounts[f.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Priority Rules */}
      <div style={{ borderBottom: '1px solid var(--border)', overflow: 'auto', flex: 1 }}>
        <button
          onClick={() => setShowRules(!showRules)}
          style={{
            width: '100%', padding: '10px 20px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)',
          }}
          onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <span>⚡ Priority Rules</span>
          <span style={{ fontSize: 10 }}>{showRules ? '▲' : '▼'}</span>
        </button>

        {showRules && (
          <div style={{ padding: '0 16px 12px' }}>
            {/* Add rule */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
              <select
                value={ruleType}
                onChange={e => setRuleType(e.target.value as keyof PriorityRules)}
                style={{
                  padding: '5px 4px', background: 'var(--bg-3)', color: 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 4, fontSize: 10, width: 28,
                  appearance: 'none', textAlign: 'center', cursor: 'pointer',
                }}
                title="Rule type"
              >
                <option value="importantSenders" title="Important sender">⬆ S</option>
                <option value="importantDomains" title="Important domain">⬆ D</option>
                <option value="importantKeywords" title="Important keyword">⬆ K</option>
                <option value="unimportantSenders" title="Ignore sender">⬇ S</option>
              </select>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRule()}
                placeholder={ruleType.includes('Domain') ? 'example.com' : ruleType.includes('Keyword') ? 'keyword' : 'email@...'}
                style={{
                  flex: 1, padding: '5px 8px', background: 'var(--bg-3)',
                  color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11,
                }}
              />
              <button onClick={addRule} style={{
                padding: '5px 8px', background: 'var(--accent)', color: '#0a0a0a',
                borderRadius: 4, fontSize: 11, fontWeight: 700,
              }}>+</button>
            </div>

            {/* Important Senders — collapsible */}
            <CollapsibleSection
              title="⬆ Important senders"
              items={rules.importantSenders}
              type="importantSenders"
              open={showImportantSenders}
              onToggle={() => setShowImportantSenders(v => !v)}
              emptyHint="No important senders"
            />

            {/* Ignore Senders — collapsible */}
            <CollapsibleSection
              title="⬇ Ignore senders"
              items={rules.unimportantSenders}
              type="unimportantSenders"
              open={showIgnoreSenders}
              onToggle={() => setShowIgnoreSenders(v => !v)}
              emptyHint="No ignored senders"
            />

            {/* Keywords — collapsible with defaults */}
            <div style={{ marginBottom: 8 }}>
              <button
                onClick={() => setShowKeywords(v => !v)}
                style={{
                  width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '4px 0', fontSize: 11, color: rules.importantKeywords.length ? 'var(--text)' : 'var(--text-muted)',
                  fontWeight: rules.importantKeywords.length ? 500 : 400,
                }}
              >
                <span>⬆ Keywords {rules.importantKeywords.length > 0 && <span style={{ fontSize: 10, background: 'var(--bg)', borderRadius: 8, padding: '1px 5px', marginLeft: 3 }}>{rules.importantKeywords.length}</span>}</span>
                <span style={{ fontSize: 9, opacity: 0.5 }}>{showKeywords ? '▲' : '▼'}</span>
              </button>
              {showKeywords && (
                <div style={{ marginTop: 4 }}>
                  {rules.importantKeywords.map(val => (
                    <div key={val} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '3px 6px', background: 'var(--bg-3)', borderRadius: 3, marginBottom: 2,
                    }}>
                      <span style={{ fontSize: 11, color: 'var(--text)' }}>{val}</span>
                      <button onClick={() => removeRule('importantKeywords', val)} style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 4, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                  {/* Default keyword suggestions */}
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>✨ Quick add:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {DEFAULT_KEYWORDS.filter(kw => !rules.importantKeywords.includes(kw)).slice(0, 8).map(kw => (
                        <button
                          key={kw}
                          onClick={() => addDefaultKeyword(kw)}
                          style={{
                            fontSize: 10, padding: '2px 7px',
                            background: 'var(--bg)', border: '1px solid var(--border)',
                            borderRadius: 10, color: 'var(--text-muted)', cursor: 'pointer',
                          }}
                          onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                          onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                          + {kw}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.5, marginTop: 4 }}>
              Rules apply on next sync
            </div>
          </div>
        )}
      </div>

      {/* Accounts */}
      <div style={{ padding: '12px 0 8px' }}>
        <div style={{ padding: '0 20px 6px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Accounts</div>
        {accounts.map((acc: Account) => (
          <div key={acc.id} style={{ padding: '6px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: acc.tokens?.access_token ? '#4caf82' : '#666',
            }} title={acc.tokens?.access_token ? 'Connected' : 'Not connected'} />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {acc.email}
              </div>
            </div>
            <button onClick={() => removeAccount(acc.id)} style={{ color: 'var(--text-muted)', fontSize: 14, flexShrink: 0 }}>×</button>
          </div>
        ))}
        <div style={{ padding: '4px 20px', position: 'relative' }}>
          <button onClick={() => setShowAddMenu(!showAddMenu)} style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add account
          </button>
          {showAddMenu && (
            <div style={{
              position: 'absolute', left: 20, top: '100%', background: 'var(--bg-3)',
              border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', zIndex: 50,
              minWidth: 160, boxShadow: '0 8px 24px var(--shadow)',
            }}>
              <a href={`${API}/auth/gmail/login?accountId=${Date.now()}`}
                style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>Gmail</a>
              <a href={`${API}/auth/outlook/login?accountId=${Date.now()}`}
                style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--text)' }}>Outlook</a>
            </div>
          )}
        </div>
      </div>

      {/* Theme toggle */}
      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Appearance</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['light', 'dark', 'system'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setPreference(opt)}
              style={{
                flex: 1, padding: '5px 0', fontSize: 10, borderRadius: 5,
                background: preference === opt ? 'var(--accent)' : 'var(--bg-3)',
                color: preference === opt ? '#0a0a0a' : 'var(--text-muted)',
                fontWeight: preference === opt ? 600 : 400,
                border: '1px solid var(--border)',
                transition: 'all 0.15s',
              }}
            >
              {opt === 'light' ? '☀' : opt === 'dark' ? '☾' : '⊙'} {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Sign out */}
      <div style={{ padding: '8px 20px', borderTop: '1px solid var(--border)' }}>
        <button onClick={async () => {
          const supabase = createClient();
          await supabase.auth.signOut();
          localStorage.removeItem('email-accounts');
          localStorage.removeItem('priority-rules');
          window.location.href = '/login';
        }} style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}
          onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >Sign out</button>
      </div>
    </aside>
  );
}
