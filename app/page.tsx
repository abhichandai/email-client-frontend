'use client';

import { useState, useEffect, useCallback } from 'react';
import { AccountProvider, useAccounts } from './context/accounts';
import Sidebar from './components/Sidebar';
import EmailList from './components/EmailList';
import EmailDetail from './components/EmailDetail';
import ComposeModal from './components/ComposeModal';
import { Email } from './types';

type MobileView = 'list' | 'detail';

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
  const [rules, setRules] = useState<PriorityRules>({ importantSenders: [], importantDomains: [], importantKeywords: [], unimportantSenders: [] });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Update a single email in state
  const updateEmail = useCallback((updated: Partial<Email> & { id: string }) => {
    setEmails(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e));
    setSelected(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);
  }, []);

  const fetchEmails = useCallback(async (pageToken?: string, forceRefresh = false) => {
    if (!accounts.length) { setError('No accounts connected.'); return; }

    pageToken ? setLoadingMore(true) : setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts, pageToken, rules, forceRefresh }),
      });
      const data = await res.json();
      if (data.error) {
        setError('Error: ' + data.error);
      } else {
        if (pageToken) {
          setEmails(prev => [...prev, ...(data.emails || [])]);
        } else {
          setEmails(data.emails || []);
          if (data.fromCache) setError(''); // clear any errors, loaded from cache
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

  // Load rules from DB on mount
  useEffect(() => {
    fetch('/api/rules').then(r => r.json()).then(data => {
      if (data?.important_senders) {
        setRules({
          importantSenders: data.important_senders || [],
          importantDomains: data.important_domains || [],
          importantKeywords: data.important_keywords || [],
          unimportantSenders: data.unimportant_senders || [],
        });
      }
    }).catch(() => {});
  }, []);

  useEffect(() => { if (accounts.length) fetchEmails(); }, [accounts]);

  const saveRules = async (newRules: PriorityRules) => {
    setRules(newRules);
    await fetch('/api/rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRules),
    });
  };

  const handleSelectEmail = (email: Email) => {
    setSelected(email);
    if (isMobile) setMobileView('detail');
    // Auto mark as read
    if (!email.isRead) {
      updateEmail({ id: email.id, isRead: true });
      const accessToken = accounts[0]?.tokens?.access_token;
      fetch('/api/email/read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId: email.id, isRead: true, accessToken }),
      });
    }
  };

  const filtered = filter === 'ALL' ? emails : emails.filter(e => e.priority === filter);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', position: 'relative' }}>
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
      )}

      <div style={{
        position: isMobile ? 'fixed' : 'relative',
        left: isMobile ? (sidebarOpen ? 0 : -280) : 'auto',
        top: 0, bottom: 0, width: isMobile ? 260 : 'auto',
        zIndex: isMobile ? 50 : 'auto',
        transition: isMobile ? 'left 0.25s ease' : 'none', flexShrink: 0,
      }}>
        <Sidebar
          accounts={accounts} filter={filter}
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
          onForceRefresh={() => fetchEmails(undefined, true)}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {error && (
          <div style={{ padding: '10px 20px', background: 'rgba(224,92,92,0.1)', borderBottom: '1px solid rgba(224,92,92,0.2)', fontSize: 12, color: '#e05c5c' }}>
            {error}
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{
            display: isMobile && mobileView === 'detail' ? 'none' : 'flex',
            flexDirection: 'column', flex: isMobile ? 1 : 'none',
            width: isMobile ? '100%' : 360, overflow: 'hidden',
          }}>
            <EmailList
              emails={filtered} loading={loading} selected={selected}
              onSelect={handleSelectEmail}
              onRefresh={() => fetchEmails(undefined, true)}
              isMobile={isMobile} onMenuOpen={() => setSidebarOpen(true)}
              loadingMore={loadingMore} hasMore={!!nextPageToken}
              onLoadMore={() => fetchEmails(nextPageToken!)}
              onEmailUpdate={updateEmail}
            />
          </div>

          <div style={{ display: isMobile && mobileView !== 'detail' ? 'none' : 'flex', flex: 1, overflow: 'hidden' }}>
            <EmailDetail
              email={selected}
              onReply={(email) => { setReplyTo(email); setComposing(true); }}
              onClose={() => { setSelected(null); if (isMobile) setMobileView('list'); }}
              isMobile={isMobile}
              onEmailUpdate={updateEmail}
            />
          </div>
        </div>
      </div>

      {composing && (
        <ComposeModal
          accounts={accounts} replyTo={replyTo}
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
