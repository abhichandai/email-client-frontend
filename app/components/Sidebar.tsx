'use client';

import { useState } from 'react';
import { useAccounts, Account } from '../context/accounts';
import { createClient } from '../../lib/supabase';

interface SidebarProps {
  accounts: Account[];
  filter: string;
  setFilter: (f: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW') => void;
  onCompose: () => void;
  emailCounts: Record<string, number>;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Sidebar({ filter, setFilter, onCompose, emailCounts }: SidebarProps) {
  const { accounts, removeAccount } = useAccounts();
  const [showAddMenu, setShowAddMenu] = useState(false);

  const filters: { key: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'; label: string; color: string }[] = [
    { key: 'ALL', label: 'All Mail', color: 'var(--text)' },
    { key: 'HIGH', label: 'Priority', color: '#e05c5c' },
    { key: 'MEDIUM', label: 'Important', color: '#d4a853' },
    { key: 'LOW', label: 'Low', color: 'var(--text-muted)' },
  ];

  return (
    <aside style={{
      width: 220,
      background: 'var(--bg-2)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 0',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 20, color: '#d4a853', letterSpacing: '-0.5px' }}>
          Inbox
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Priority Mail</div>
      </div>

      {/* Compose */}
      <div style={{ padding: '16px 16px 8px' }}>
        <button
          onClick={onCompose}
          style={{
            width: '100%',
            padding: '9px 14px',
            background: '#d4a853',
            color: '#0a0a0a',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '0.2px',
            transition: 'opacity 0.15s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
        >
          + Compose
        </button>
      </div>

      {/* Filters */}
      <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 20px',
              background: filter === f.key ? 'rgba(212,168,83,0.08)' : 'transparent',
              color: filter === f.key ? f.color : 'var(--text-muted)',
              fontSize: 13,
              transition: 'all 0.1s',
              borderLeft: filter === f.key ? `2px solid ${f.color}` : '2px solid transparent',
            }}
          >
            <span>{f.label}</span>
            <span style={{
              fontSize: 11,
              background: 'rgba(255,255,255,0.06)',
              padding: '1px 6px',
              borderRadius: 10,
            }}>
              {emailCounts[f.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Accounts */}
      <div style={{ flex: 1, padding: '16px 0', overflow: 'auto' }}>
        <div style={{ padding: '0 20px 8px', fontSize: 11, color: '#444', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Accounts
        </div>
        {accounts.map((acc) => {
          const hasToken = !!(acc.tokens?.access_token);
          return (
            <div
              key={acc.id}
              style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: hasToken ? '#4caf82' : '#666',
                flexShrink: 0,
              }} title={hasToken ? 'Connected' : 'Not connected'} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {acc.email}
                </div>
              </div>
              <button
                onClick={() => removeAccount(acc.id)}
                style={{ color: '#444', fontSize: 14, flexShrink: 0 }}
                title="Remove account"
              >
                ×
              </button>
            </div>
          );
        })}

        {/* Add account */}
        <div style={{ padding: '8px 20px', position: 'relative' }}>
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add account
          </button>
          {showAddMenu && (
            <div style={{
              position: 'absolute',
              left: 20,
              top: '100%',
              background: 'var(--bg-3)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              overflow: 'hidden',
              zIndex: 50,
              minWidth: 160,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <a
                href={`${API}/auth/gmail/login?accountId=${Date.now()}`}
                style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)' }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-2)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Gmail
              </a>
              <a
                href={`${API}/auth/outlook/login?accountId=${Date.now()}`}
                style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--text)' }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-2)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Outlook
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Sign out */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            localStorage.removeItem('email-accounts');
            window.location.href = '/login';
          }}
          style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}
          onMouseOver={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
