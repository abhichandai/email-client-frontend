'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AccountProvider, useAccounts } from './context/accounts';
import Sidebar from './components/Sidebar';
import EmailList from './components/EmailList';
import EmailDetail from './components/EmailDetail';
import ComposeModal from './components/ComposeModal';
import { Email, isCalendarEmail } from './types';

type MobileView = 'list' | 'detail';
export type FilterType = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MARKETING' | 'CALENDAR' | 'COMPLETE';

interface PriorityRules {
  importantSenders: string[];
  importantDomains: string[];
  importantKeywords: string[];
  unimportantSenders: string[];
}

function groupIntoThreads(emails: Email[]): Email[] {
  const threadMap = new Map<string, Email[]>();
  for (const email of emails) {
    const key = email.threadId || email.id;
    if (!threadMap.has(key)) threadMap.set(key, []);
    threadMap.get(key)!.push(email);
  }
  return Array.from(threadMap.values())
    .map(group => {
      const sorted = [...group].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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

  // Mark email/thread as complete
  const completeEmail = useCallback(async (email: Email, isComplete: boolean) => {
    const threadId = email.threadId;
    // Update all emails in thread locally
    setEmails(prev => prev.map(e =>
      (threadId && e.threadId === threadId) || e.id === email.id
        ? { ...e, isComplete }
        : e
    ));
    if (selected?.threadId === threadId || selected?.id === email.id) {
      setSelected(null);
      if (isMobile) setMobileView('list');
    }
    await fetch('/api/email/complete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: email.id, threadId, isComplete }),
    });
  }, [selected, isMobile]);

  // Load from DB (instant)
  const loadFromDB = useCallback(async () => {
    if (!accounts.length) return;
    try {
      const res = await fetch('/api/inbox', { method: 'GET' });
      const data = await res.json();
      if (data.emails?.length) {
        setEmails(data.emails);
        if (data.rules) {
          setRules({
            importantSenders: data.rules.important_senders || [],
            importantDomains: data.rules.important_domains || [],
            importantKeywords: data.rules.important_keywords || [],
            unimportantSenders: data.rules.unimportant_senders || [],
          });
        }
      }
    } catch { /* silent */ }
  }, [accounts]);

  // Sync from Gmail (background or forced)
  const syncFromGmail = useCallback(async (showSpinner = true, pageToken?: string, forceRefresh = false) => {
    if (!accounts.length) return;
    if (showSpinner) pageToken ? setLoadingMore(true) : setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accounts: accounts.map(a => ({ provider: a.provider, email: a.email, tokens: a.tokens })),
          pageToken, rules, forceRefresh,
        }),
      });
      const data = await res.json();

      if (data.error === 'SESSION_EXPIRED' || res.status === 401) {
        setError('Your Gmail session has expired. Please sign out and sign back in to reconnect.');
        return;
      }
      if (data.error) {
        setError(`Sync failed: ${data.error}`);
        return;
      }
      if (data.emails) {
        if (pageToken) {
          setEmails(prev => {
            const newIds = new Set(data.emails.map((e: Email) => e.id));
            return [...prev.filter(e => !newIds.has(e.id)), ...data.emails];
          });
        } else {
          setEmails(data.emails);
        }
        setNextPageToken(data.nextPageToken || null);
      }
    } catch (e) {
      setError(`Connection error: ${String(e)}`);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [accounts, rules]);

  // On mount: instant DB load, then background sync
  useEffect(() => {
    if (!accounts.length) return;
    loadFromDB().then(() => syncFromGmail(false));
    const interval = setInterval(() => syncFromGmail(false), 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [accounts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveRules = useCallback(async (newRules: PriorityRules) => {
    setRules(newRules);
    try {
      const res = await fetch('/api/rules', { method: 'GET' });
      const data = await res.json();
      await fetch('/api/rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, ...newRules }),
      });
    } catch { /* silent */ }
  }, []);

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

  // Filter logic — complete emails only show in COMPLETE tab
  const filtered = useMemo(() => {
    const activeEmails = emails.filter(e => !e.isComplete);
    const completeEmails = emails.filter(e => e.isComplete);

    if (filter === 'COMPLETE') return completeEmails;
    if (filter === 'CALENDAR') return activeEmails.filter(isCalendarEmail);
    if (filter !== 'ALL') return activeEmails.filter(e => e.priority === filter);
    // ALL: show everything except marketing and complete
    return activeEmails.filter(e => e.priority !== 'MARKETING');
  }, [emails, filter]);

  const threads = useMemo(() => groupIntoThreads(filtered), [filtered]);

  const emailCounts = useMemo(() => {
    const active = emails.filter(e => !e.isComplete);
    return {
      ALL: active.filter(e => e.priority !== 'MARKETING').length,
      HIGH: active.filter(e => e.priority === 'HIGH').length,
      MEDIUM: active.filter(e => e.priority === 'MEDIUM').length,
      LOW: active.filter(e => e.priority === 'LOW').length,
      MARKETING: active.filter(e => e.priority === 'MARKETING').length,
      CALENDAR: active.filter(isCalendarEmail).length,
      COMPLETE: emails.filter(e => e.isComplete).length,
    };
  }, [emails]);

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
          emailCounts={emailCounts} rules={rules} onSaveRules={saveRules}
          onForceRefresh={() => syncFromGmail(true, undefined, true)}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {error && (
          <div style={{
            padding: '10px 20px', borderBottom: '1px solid rgba(224,92,92,0.2)',
            fontSize: 12, color: '#e05c5c', background: 'rgba(224,92,92,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>{error}</span>
            <button onClick={() => setError('')} style={{ color: '#e05c5c', fontSize: 16, opacity: 0.6 }}>×</button>
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
              onComplete={completeEmail}
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
              onComplete={completeEmail}
              accessToken={accounts[0]?.tokens?.access_token}
            />
          </div>
        </div>
      </div>

      {composing && (
        <ComposeModal
          accounts={accounts} replyTo={replyTo}
          onClose={() => { setComposing(false); setReplyTo(null); }}
          apiUrl=""
        />
      )}
    </div>
  );
}

export default function Home() {
  return <AccountProvider><InboxApp /></AccountProvider>;
}
