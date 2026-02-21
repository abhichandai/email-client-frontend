'use client';

import { useState } from 'react';
import { useAccounts, Account } from '../context/accounts';
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
  setFilter: (f: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW') => void;
  onCompose: () => void;
  emailCounts: Record<string, number>;
  rules: PriorityRules;
  onSaveRules: (rules: PriorityRules) => void;
  onForceRefresh: () => void;
  onForceSync: () => void;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Sidebar({ filter, setFilter, onCompose, emailCounts, rules, onSaveRules, onForceSync }: SidebarProps) {
  const { accounts, removeAccount } = useAccounts();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [input, setInput] = useState('');
  const [ruleType, setRuleType] = useState<keyof PriorityRules>('importantSenders');

  const filters: { key: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'; label: string; color: string }[] = [
    { key: 'ALL', label: 'All Mail', color: 'var(--text)' },
    { key: 'HIGH', label: 'Priority', color: '#e05c5c' },
    { key: 'MEDIUM', label: 'Important', color: '#d4a853' },
    { key: 'LOW', label: 'Low', color: 'var(--text-muted)' },
  ];

  const addRule = () => {
    const val = input.trim();
    if (!val) return;
    if (rules[ruleType].includes(val)) return;
    onSaveRules({ ...rules, [ruleType]: [...rules[ruleType], val] });
    setInput('');
  };

  const removeRule = (type: keyof PriorityRules, val: string) => {
    onSaveRules({ ...rules, [type]: rules[type].filter(x => x !== val) });
  };

  const ruleLabels: Record<keyof PriorityRules, string> = {
    importantSenders: '⬆ Important senders',
    importantDomains: '⬆ Important domains',
    importantKeywords: '⬆ Keywords',
    unimportantSenders: '⬇ Ignore senders',
  };

  return (
    <aside style={{
      width: 220,
      background: 'var(--bg-2)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 0',
      flexShrink: 0,
      height: '100%',
    }}>
      {/* Logo */}
      <div style={{
        padding: '0 20px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(180deg, rgba(212,168,83,0.04) 0%, transparent 100%)',
      }}>
        <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 22, letterSpacing: '-0.3px', color: '#e3e3e3' }}>
          mail<span style={{ color: '#d4a853' }}>mfer</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Priority Inbox</div>
      </div>

      {/* Compose + Sync */}
      <div style={{ padding: '16px 16px 8px', display: 'flex', gap: 6 }}>
        <button onClick={onCompose} style={{
          flex: 1, padding: '9px 14px', background: '#d4a853', color: '#0a0a0a',
          borderRadius: 6, fontSize: 13, fontWeight: 500, transition: 'opacity 0.15s',
        }}
          onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseOut={e => (e.currentTarget.style.opacity = '1')}
        >+ Compose</button>
        <button onClick={onForceSync} title="Sync fresh from Gmail" style={{
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
            background: filter === f.key ? 'rgba(212,168,83,0.08)' : 'transparent',
            color: filter === f.key ? f.color : 'var(--text-muted)',
            fontSize: 13, transition: 'all 0.1s',
            borderLeft: filter === f.key ? `2px solid ${f.color}` : '2px solid transparent',
          }}>
            <span>{f.label}</span>
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 10 }}>
              {emailCounts[f.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Priority Rules */}
      <div style={{ borderBottom: '1px solid var(--border)' }}>
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
            {/* Rule type selector */}
            <select
              value={ruleType}
              onChange={e => setRuleType(e.target.value as keyof PriorityRules)}
              style={{
                width: '100%', padding: '6px 8px', background: 'var(--bg-3)',
                color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4,
                fontSize: 11, marginBottom: 6,
              }}
            >
              {Object.entries(ruleLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            {/* Add rule input */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRule()}
                placeholder={ruleType.includes('Domain') ? 'example.com' : ruleType.includes('Keyword') ? 'urgent' : 'name@email.com'}
                style={{
                  flex: 1, padding: '5px 8px', background: 'var(--bg-3)',
                  color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11,
                }}
              />
              <button onClick={addRule} style={{
                padding: '5px 8px', background: '#d4a853', color: '#0a0a0a',
                borderRadius: 4, fontSize: 11, fontWeight: 600,
              }}>+</button>
            </div>

            {/* Existing rules */}
            {(Object.keys(ruleLabels) as (keyof PriorityRules)[]).map(type => (
              rules[type].length > 0 && (
                <div key={type} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: '#555', marginBottom: 3 }}>{ruleLabels[type]}</div>
                  {rules[type].map(val => (
                    <div key={val} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '3px 6px', background: 'var(--bg-3)', borderRadius: 3, marginBottom: 2,
                    }}>
                      <span style={{ fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
                      <button onClick={() => removeRule(type, val)} style={{ color: '#555', fontSize: 12, marginLeft: 4, flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              )
            ))}
            <div style={{ fontSize: 10, color: '#444', marginTop: 4, lineHeight: 1.5 }}>
              Rules apply on next refresh
            </div>
          </div>
        )}
      </div>

      {/* Accounts */}
      <div style={{ flex: 1, padding: '16px 0', overflow: 'auto' }}>
        <div style={{ padding: '0 20px 8px', fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Accounts</div>
        {accounts.map((acc) => (
          <div key={acc.id} style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: acc.tokens?.access_token ? '#4caf82' : '#666',
            }} title={acc.tokens?.access_token ? 'Connected' : 'Not connected'} />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {acc.email}
              </div>
            </div>
            <button onClick={() => removeAccount(acc.id)} style={{ color: '#444', fontSize: 14, flexShrink: 0 }}>×</button>
          </div>
        ))}
        <div style={{ padding: '8px 20px', position: 'relative' }}>
          <button onClick={() => setShowAddMenu(!showAddMenu)} style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add account
          </button>
          {showAddMenu && (
            <div style={{
              position: 'absolute', left: 20, top: '100%', background: 'var(--bg-3)',
              border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', zIndex: 50,
              minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <a href={`${API}/auth/gmail/login?accountId=${Date.now()}`}
                style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>Gmail</a>
              <a href={`${API}/auth/outlook/login?accountId=${Date.now()}`}
                style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--text)' }}>Outlook</a>
            </div>
          )}
        </div>
      </div>

      {/* Sign out */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
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
