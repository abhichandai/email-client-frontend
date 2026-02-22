'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAccounts, Account } from '../context/accounts';
import { useTheme } from '../context/theme';
import { createClient } from '../../lib/supabase';

interface SidebarProps {
  filter: string;
  setFilter: (f: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MARKETING' | 'CALENDAR' | 'COMPLETE' | 'SENT' | 'SNOOZED') => void;
  onCompose: () => void;
  emailCounts: Record<string, number>;
  onForceRefresh: () => void;
  onShowShortcuts?: () => void;
}

const NAV_FILTERS: { key: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MARKETING' | 'CALENDAR' | 'COMPLETE' | 'SENT' | 'SNOOZED'; label: string; icon: string; color: string }[] = [
  { key: 'ALL',       label: 'All Mail',  icon: '✉',  color: 'var(--text)' },
  { key: 'HIGH',      label: 'Priority',  icon: '●',  color: 'var(--high)' },
  { key: 'MEDIUM',    label: 'Important', icon: '●',  color: 'var(--med)' },
  { key: 'LOW',       label: 'Low',       icon: '●',  color: 'var(--text-muted)' },
  { key: 'MARKETING', label: 'Marketing', icon: '📣', color: '#8b7cf8' },
  { key: 'CALENDAR',  label: 'Calendar',  icon: '📅', color: '#7ab3d4' },
  { key: 'SENT',      label: 'Sent',      icon: '↗',  color: 'var(--text-muted)' },
  { key: 'SNOOZED',   label: 'Snoozed',   icon: '🔕', color: '#9b8ea8' },
  { key: 'COMPLETE',  label: 'Complete',  icon: '✓',  color: '#4caf82' },
];

export default function Sidebar({ filter, setFilter, onCompose, emailCounts, onForceRefresh, onShowShortcuts }: SidebarProps) {
  const { accounts, removeAccount } = useAccounts();
  const { preference, setPreference } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored === 'true') setCollapsed(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  const w = collapsed ? 56 : 220;

  return (
    <aside style={{
      width: w, minWidth: w, background: 'var(--bg-2)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100%',
      transition: 'width 0.2s ease, min-width 0.2s ease', overflow: 'hidden',
    }}>

      {/* Logo + collapse */}
      <div style={{
        padding: collapsed ? '20px 0' : '20px 16px 20px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        minHeight: 64,
      }}>
        {!collapsed && (
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 20, letterSpacing: '-0.3px' }}>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>mail</span>
            <span style={{ color: 'var(--accent)' }}>mfer</span>
          </div>
        )}
        <button onClick={() => setCollapsed(v => !v)}
          title={collapsed ? 'Expand' : 'Collapse'}
          style={{ color: 'var(--text-muted)', fontSize: 13, padding: 4, borderRadius: 4 }}
          onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >{collapsed ? '›' : '‹'}</button>
      </div>

      {/* Compose + Sync */}
      <div style={{
        padding: collapsed ? '10px 8px' : '10px 10px 4px',
        display: 'flex', gap: 6,
        flexDirection: collapsed ? 'column' : 'row',
      }}>
        <button onClick={onCompose} title="Compose"
          style={{
            flex: 1, padding: collapsed ? '9px 0' : '8px 12px',
            background: 'var(--accent)', color: '#0a0a0a', borderRadius: 6,
            fontSize: collapsed ? 18 : 13, fontWeight: 500, textAlign: 'center',
          }}
          onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseOut={e => (e.currentTarget.style.opacity = '1')}
        >{collapsed ? '+' : '+ Compose'}</button>
        <button onClick={onForceRefresh} title="Sync from Gmail"
          style={{
            padding: '8px', background: 'var(--bg-3)', color: 'var(--text-muted)',
            border: '1px solid var(--border)', borderRadius: 6, fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseOver={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >↺</button>
      </div>

      {/* Nav */}
      <div style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', flex: 1, overflowY: 'auto' }}>
        {NAV_FILTERS.map(f => {
          const active = filter === f.key;
          const count = emailCounts[f.key] || 0;
          return (
            <button key={f.key} onClick={() => setFilter(f.key)}
              title={collapsed ? `${f.label} (${count})` : undefined}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'space-between',
                padding: collapsed ? '9px 0' : '7px 20px',
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? f.color : 'var(--text-muted)',
                fontSize: 13, transition: 'all 0.1s',
                borderLeft: active ? `2px solid ${f.color}` : '2px solid transparent',
                position: 'relative',
              }}
              onMouseOver={e => { if (!active) e.currentTarget.style.color = 'var(--text)'; }}
              onMouseOut={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              {collapsed ? (
                <span style={{ position: 'relative', display: 'inline-flex' }}>
                  <span style={{ color: active ? f.color : 'var(--text-muted)', fontSize: f.icon.length > 1 ? 14 : 9 }}>{f.icon}</span>
                  {count > 0 && (
                    <span style={{
                      position: 'absolute', top: -5, right: -8, fontSize: 8,
                      background: f.color, color: '#fff', borderRadius: 6,
                      padding: '1px 3px', fontWeight: 700, minWidth: 12, textAlign: 'center',
                    }}>{count > 99 ? '99+' : count}</span>
                  )}
                </span>
              ) : (
                <>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: f.color, fontSize: f.icon.length > 1 ? 13 : 8, width: 14, textAlign: 'center' }}>{f.icon}</span>
                    {f.label}
                  </span>
                  <span style={{ fontSize: 11, background: 'rgba(128,128,128,0.08)', padding: '1px 6px', borderRadius: 10 }}>
                    {count}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Accounts - hidden when collapsed */}
      {!collapsed && (
        <div style={{ padding: '10px 0 6px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ padding: '0 20px 5px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Accounts
          </div>
          {accounts.map((acc: Account) => (
            <div key={acc.id} style={{ padding: '5px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4caf82', flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {acc.email}
              </div>
              <button onClick={() => removeAccount(acc.id)} style={{ color: 'var(--text-muted)', fontSize: 14 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: collapsed ? '8px 0' : '8px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex', flexDirection: collapsed ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: collapsed ? 2 : 0,
      }}>
        {collapsed ? (
          <>
            {[
              { icon: '⚙', title: 'Settings', action: () => router.push('/settings'), active: pathname === '/settings' },
              { icon: '?', title: 'Keyboard shortcuts', action: onShowShortcuts || (() => {}), active: false },
              { icon: '↩', title: 'Sign out', action: async () => {
                const s = createClient(); await s.auth.signOut();
                localStorage.removeItem('email-accounts'); window.location.href = '/login';
              }, active: false },
            ].map(({ icon, title, action, active }) => (
              <button key={icon} title={title} onClick={action}
                style={{
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: icon === '?' ? 11 : 14, padding: '5px 0',
                  width: '100%', textAlign: 'center', fontFamily: icon === '?' ? 'monospace' : undefined, fontWeight: icon === '?' ? 700 : undefined,
                }}
                onMouseOver={e => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseOut={e => (e.currentTarget.style.color = active ? 'var(--accent)' : 'var(--text-muted)')}
              >{icon}</button>
            ))}
          </>
        ) : (
          <>
            <button onClick={async () => {
              const s = createClient(); await s.auth.signOut();
              localStorage.removeItem('email-accounts'); window.location.href = '/login';
            }} style={{ fontSize: 12, color: 'var(--text-muted)' }}
              onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >Sign out</button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Theme icons */}
              {(['light', 'dark', 'system'] as const).map((opt, i) => (
                <button key={opt} onClick={() => setPreference(opt)}
                  title={opt.charAt(0).toUpperCase() + opt.slice(1) + ' mode'}
                  style={{
                    fontSize: 13, color: preference === opt ? 'var(--accent)' : 'var(--text-muted)',
                    padding: '2px 3px', borderRadius: 3,
                    borderRight: i < 2 ? '1px solid var(--border)' : undefined, paddingRight: i < 2 ? 6 : 3,
                  }}
                  onMouseOver={e => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseOut={e => (e.currentTarget.style.color = preference === opt ? 'var(--accent)' : 'var(--text-muted)')}
                >{opt === 'light' ? '☀' : opt === 'dark' ? '☾' : '⊙'}</button>
              ))}
              <button onClick={() => router.push('/settings')}
                style={{ fontSize: 12, color: pathname === '/settings' ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}
                onMouseOver={e => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseOut={e => (e.currentTarget.style.color = pathname === '/settings' ? 'var(--accent)' : 'var(--text-muted)')}
              >⚙ Settings</button>
              <button onClick={onShowShortcuts}
                style={{
                  fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', width: 20, height: 20,
                  border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'monospace', fontWeight: 700,
                }}
                onMouseOver={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'rgba(212,168,83,0.4)'; }}
                onMouseOut={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >?</button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
