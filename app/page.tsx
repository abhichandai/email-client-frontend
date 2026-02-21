'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AccountProvider, useAccounts } from './context/accounts';
import Sidebar from './components/Sidebar';
import EmailList from './components/EmailList';
import EmailDetail from './components/EmailDetail';
import ComposeModal from './components/ComposeModal';
import { Email, isCalendarEmail } from './types';

type MobileView = 'list' | 'detail';
export type FilterType = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CALENDAR';

interface PriorityRules {
  importantSenders: string[];
  importantDomains: string[];
  importantKeywords: string[];
  unimportantSenders: string[];
}

// Group flat email list into threads — one entry per thread, latest email on top
function groupIntoThreads(emails: Email[]): Email[] {
  const threadMap = new Map<string, Email[]>();
  for (const email of emails) {
    const key = email.threadId || email.id;
    if (!threadMap.has(key)) threadMap.set(key, []);
    threadMap.get(key)!.push(email);
  }
  return Array.from(threadMap.values())
    .map(group => {
      const sorted = [...group].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      return { ...sorted[0], threadCount: sorted.length, threadEmails: sorted };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function InboxApp() {
  const { accounts } = useAccounts();
  const [emails, setEmails] = useState<Email[]>([]);
  const [selected, setSelected] = useState<Email | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [composing, setComposing] = useState(false);
  const [replyTo, setReplyTo] = useState<Email | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('list');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [rules, setRules] = useState<PriorityRules>({
    importantSenders: [], importantDomains: [], importantKeywords: [], unimportantSenders: [],
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const updateEmail = useCallback((updated: Partial<Email> & { id: string }) => {
    setEmails(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e));
    setSelected(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);
  }, []);

  const bulkUpdateEmails = useCallback((freshEmails: Email[]) => {
    setEmails(freshEmails);
    setSelected(prev => prev ? (freshEmails.find(e => e.id === prev.id) || prev) : null);
  }, []);

  // POST /api/inbox — syncs from Gmail, showSpinner=false for background updates
  const syncFromGmail = useCallback(async (showSpinner = true, pageToken?: string, forceRefresh = false) => {
    if (!accounts.length) return;
    if (showSpinner) pageToken ? setLoadingMore(true) : setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts, pageToken, rules, forceRefresh }),
      });
      const data = await res.json();
      if (data.error) {
        if (showSpinner) setError('Error: ' + data.error);
      } else {
        if (pageToken) {
          setEmails(prev => [...prev, ...(data.emails || [])]);
        } else {
          setEmails(data.emails || []);
        }
        setNextPageToken(data.nextPageToken || null);
      }
    } catch (e) {
      if (showSpinner) setError('Could not reach backend: ' + String(e));
    } finally {
      if (showSpinner) { setLoading(false); setLoadingMore(false); }
    }
  }, [accounts, rules]);

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

  // On accounts ready: load DB instantly (no spinner), then sync Gmail in background
  useEffect(() => {
    if (!accounts.length) return;
    (async () => {
      try {
        const res = await fetch('/api/inbox');
        const data = await res.json();
        if (data.emails?.length) {
          setEmails(data.emails);
          syncFromGmail(false); // silent background sync
          return;
        }
      } catch {}
      syncFromGmail(true); // no DB data yet, show spinner
    })();
  }, [accounts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Background polling every 3 minutes
  useEffect(() => {
    if (!accounts.length) return;
    const interval = setInterval(() => syncFromGmail(false), 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [accounts, syncFromGmail]);

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
    if (!email.isRead) {
      updateEmail({ id: email.id, isRead: true });
      const accessToken = accounts[0]?.tokens?.access_token;
      fetch('/api/email/read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId: email.id, isRead: true, accessToken }),
      });
    }
  };

  const filtered = useMemo(() => {
    if (filter === 'CALENDAR') return emails.filter(isCalendarEmail);
    if (filter !== 'ALL') return emails.filter(e => e.priority === filter);
    return emails;
  }, [emails, filter]);

  const threads = useMemo(() => groupIntoThreads(filtered), [filtered]);

  const emailCounts = useMemo(() => ({
    ALL: emails.length,
    HIGH: emails.filter(e => e.priority === 'HIGH').length,
    MEDIUM: emails.filter(e => e.priority === 'MEDIUM').length,
    LOW: emails.filter(e => e.priority === 'LOW').length,
    CALENDAR: emails.filter(isCalendarEmail).length,
  }), [emails]);

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
          setFilter={(f) => { setFilter(f as FilterType); if (isMobile) setSidebarOpen(false); }}
          onCompose={() => { setReplyTo(null); setComposing(true); setSidebarOpen(false); }}
          emailCounts={emailCounts}
          rules={rules}
          onSaveRules={saveRules}
          onForceRefresh={() => syncFromGmail(true, undefined, true)}
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
              emails={threads} loading={loading} selected={selected}
              onSelect={handleSelectEmail}
              onRefresh={() => syncFromGmail(true, undefined, true)}
              isMobile={isMobile} onMenuOpen={() => setSidebarOpen(true)}
              loadingMore={loadingMore} hasMore={!!nextPageToken}
              onLoadMore={() => syncFromGmail(true, nextPageToken!)}
              onEmailUpdate={updateEmail}
              onBulkUpdate={bulkUpdateEmails}
            />
          </div>
          <div style={{ display: isMobile && mobileView !== 'detail' ? 'none' : 'flex', flex: 1, overflow: 'hidden' }}>
            <EmailDetail
              email={selected}
              onReply={(email) => { setReplyTo(email); setComposing(true); }}
              onClose={() => { setSelected(null); if (isMobile) setMobileView('list'); }}
              isMobile={isMobile}
              onEmailUpdate={updateEmail}
              onBulkUpdate={bulkUpdateEmails}
              accessToken={accounts[0]?.tokens?.access_token}
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
