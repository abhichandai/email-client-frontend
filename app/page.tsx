'use client';

import { useState, useEffect, useCallback } from 'react';
import { AccountProvider, useAccounts } from './context/accounts';
import Sidebar from './components/Sidebar';
import EmailList from './components/EmailList';
import EmailDetail from './components/EmailDetail';
import ComposeModal from './components/ComposeModal';
import { Email } from './types';

type MobileView = 'sidebar' | 'list' | 'detail';

interface PriorityRules {
  importantSenders: string[];
  importantDomains: string[];
  importantKeywords: string[];
  unimportantSenders: string[];
}

function InboxApp() {
  const { accounts } = useAccounts();
  const [emails, setEmails] = useState<Email[]>([]);
  const [selected, setSelected] = useState<Email | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [composing, setComposing] = useState(false);
  const [replyTo, setReplyTo] = useState<Email | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('list');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [rules, setRules] = useState<PriorityRules>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('priority-rules');
      if (stored) return JSON.parse(stored);
    }
    return { importantSenders: [], importantDomains: [], importantKeywords: [], unimportantSenders: [] };
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const fetchEmails = useCallback(async (pageToken?: string) => {
    if (!accounts.length) { setError('No accounts connected.'); return; }
    const hasTokens = accounts.every(a => a.tokens?.access_token);
    if (!hasTokens) { setError('No access token. Please sign out and sign in again.'); return; }

    pageToken ? setLoadingMore(true) : setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts, pageToken, rules }),
      });
      const data = await res.json();
      if (data.error) {
        setError('Error: ' + data.error);
      } else {
        if (pageToken) {
          setEmails(prev => [...prev, ...(data.emails || [])]);
        } else {
          setEmails(data.emails || []);
        }
        setNextPageToken(data.nextPageToken || null);
      }
    } catch (e) {
      setError('Could not reach backend: ' + String(e));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [accounts, rules]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const saveRules = (newRules: PriorityRules) => {
    setRules(newRules);
    localStorage.setItem('priority-rules', JSON.stringify(newRules));
  };

  const filtered = filter === 'ALL' ? emails : emails.filter((e) => e.priority === filter);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', position: 'relative' }}>

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
      )}

      <div style={{
        position: isMobile ? 'fixed' : 'relative',
        left: isMobile ? (sidebarOpen ? 0 : -280) : 'auto',
        top: 0, bottom: 0,
        width: isMobile ? 260 : 'auto',
        zIndex: isMobile ? 50 : 'auto',
        transition: isMobile ? 'left 0.25s ease' : 'none',
        flexShrink: 0,
      }}>
        <Sidebar
          accounts={accounts}
          filter={filter}
          setFilter={(f) => { setFilter(f); if (isMobile) setSidebarOpen(false); }}
          onCompose={() => { setReplyTo(null); setComposing(true); setSidebarOpen(false); }}
          emailCounts={{
            ALL: emails.length,
            HIGH: emails.filter(e => e.priority === 'HIGH').length,
            MEDIUM: emails.filter(e => e.priority === 'MEDIUM').length,
            LOW: emails.filter(e => e.priority === 'LOW').length,
          }}
          rules={rules}
          onSaveRules={saveRules}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {error && (
          <div style={{
            padding: '10px 20px', background: 'rgba(224,92,92,0.1)',
            borderBottom: '1px solid rgba(224,92,92,0.2)', fontSize: 12, color: '#e05c5c',
          }}>{error}</div>
        )}

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{
            display: isMobile && mobileView === 'detail' ? 'none' : 'flex',
            flexDirection: 'column',
            flex: isMobile ? 1 : 'none',
            width: isMobile ? '100%' : 360,
            overflow: 'hidden',
          }}>
            <EmailList
              emails={filtered}
              loading={loading}
              selected={selected}
              onSelect={(email) => { setSelected(email); if (isMobile) setMobileView('detail'); }}
              onRefresh={() => fetchEmails()}
              isMobile={isMobile}
              onMenuOpen={() => setSidebarOpen(true)}
              loadingMore={loadingMore}
              hasMore={!!nextPageToken}
              onLoadMore={() => fetchEmails(nextPageToken!)}
            />
          </div>

          <div style={{
            display: isMobile && mobileView !== 'detail' ? 'none' : 'flex',
            flex: 1, overflow: 'hidden',
          }}>
            <EmailDetail
              email={selected}
              onReply={(email) => { setReplyTo(email); setComposing(true); }}
              onClose={() => { setSelected(null); if (isMobile) setMobileView('list'); }}
              isMobile={isMobile}
            />
          </div>
        </div>
      </div>

      {composing && (
        <ComposeModal
          accounts={accounts}
          replyTo={replyTo}
          onClose={() => { setComposing(false); setReplyTo(null); }}
          apiUrl={process.env.NEXT_PUBLIC_API_URL || ''}
        />
      )}
    </div>
  );
}

export default function Home() {
  return <AccountProvider><InboxApp /></AccountProvider>;
}
