'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AccountProvider, useAccounts } from './context/accounts';
import Sidebar from './components/Sidebar';
import EmailList from './components/EmailList';
import EmailDetail from './components/EmailDetail';
import ComposeModal from './components/ComposeModal';
import KeyboardShortcutsHelp from './components/KeyboardShortcutsHelp';
import { Email, isCalendarEmail } from './types';

type MobileView = 'list' | 'detail';
export type FilterType = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MARKETING' | 'CALENDAR' | 'COMPLETE' | 'SENT' | 'SNOOZED';

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
  const router = useRouter();
  const [emails, setEmails] = useState<Email[]>([]);
  const [selected, setSelected] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [composing, setComposing] = useState(false);
  const [replyTo, setReplyTo] = useState<Email | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('list');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Undo send state
  interface PendingSend { to: string; subject: string; body: string; fromEmail: string; threadId?: string; replyAll?: boolean; }
  const [pendingSend, setPendingSend] = useState<PendingSend | null>(null);
  const [sendCountdown, setSendCountdown] = useState(0);
  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Email[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    // Build a lookup by id so we only patch priority fields — preserve isComplete, isMarketing, snoozedUntil, etc.
    const updates = new Map(freshEmails.map(e => [e.id, e]));
    setEmails(prev => prev.map(e => {
      const update = updates.get(e.id);
      return update ? { ...e, priority: update.priority, priority_override: update.priority_override } : e;
    }));
    setSelected(prev => {
      if (!prev) return null;
      const update = updates.get(prev.id);
      return update ? { ...prev, priority: update.priority, priority_override: update.priority_override } : prev;
    });
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
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [accounts]);

  // Sync from Gmail (background or forced)
  const syncFromGmail = useCallback(async (showSpinner = true, pageToken?: string, forceRefresh = false) => {
    if (!accounts.length) return;
    if (showSpinner) {
      pageToken ? setLoadingMore(true) : setLoading(true);
    } else {
      setIsSyncing(true);
    }
    setError('');
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageToken, rules, forceRefresh }),
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
      setIsSyncing(false);
    }
  }, [accounts, rules]);

  // On mount: instant DB load, then background sync
  useEffect(() => {
    if (!accounts.length) return;
    loadFromDB().then(() => syncFromGmail(false));
    const interval = setInterval(() => syncFromGmail(false), 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [accounts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check onboarding status — redirect new users
  useEffect(() => {
    fetch('/api/onboard').then(r => r.json()).then(data => {
      if (data.onboarded === false) router.push('/onboarding');
    }).catch(() => {}); // non-fatal — worst case they skip onboarding
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });
        const data = await res.json();
        setSearchResults(data.emails || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults(null);
  }, []);

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

  const loadSentEmails = useCallback(async () => {
    if (!accounts.length) return;
    try {
      const res = await fetch('/api/sent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.emails) setSentEmails(data.emails);
    } catch { /* silent */ }
  }, [accounts]);

  const deleteEmail = useCallback(async (email: Email) => {
    setEmails(prev => prev.filter(e => e.id !== email.id));
    if (selected?.id === email.id) { setSelected(null); if (isMobile) setMobileView('list'); }
    await fetch('/api/email/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: email.id }),
    });
  }, [selected, isMobile]);


  const snoozeEmail = useCallback(async (email: Email, until: string | null) => {
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, snoozedUntil: until } : e));
    if (until && selected?.id === email.id) { setSelected(null); if (isMobile) setMobileView('list'); }
    await fetch('/api/email/snooze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId: email.id, until }),
    });
  }, [selected, isMobile]);

  const handleSelectEmail = (email: Email) => {
    setSelected(email);
    if (isMobile) setMobileView('detail');
    if (!email.isRead) {
      updateEmail({ id: email.id, isRead: true });
      fetch('/api/email/read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId: email.id, isRead: true }),
      });
    }
  };

  // Filter logic — complete/snoozed emails only show in their tabs
  const filtered = useMemo(() => {
    if (filter === 'SENT') return sentEmails;
    const now = new Date();
    const snoozed = emails.filter(e => e.snoozedUntil && new Date(e.snoozedUntil) > now);
    const activeEmails = emails.filter(e => !e.isComplete && (!e.snoozedUntil || new Date(e.snoozedUntil) <= now));
    const completeEmails = emails.filter(e => e.isComplete);

    if (filter === 'SNOOZED') return snoozed;
    if (filter === 'COMPLETE') return completeEmails;
    if (filter === 'CALENDAR') return activeEmails.filter(isCalendarEmail);
    if (filter === 'MARKETING') return activeEmails.filter(e => e.isMarketing);
    if (filter === 'HIGH') return activeEmails.filter(e => e.priority === 'HIGH' && !e.isMarketing);
    if (filter === 'MEDIUM') return activeEmails.filter(e => e.priority === 'MEDIUM' && !e.isMarketing);
    if (filter === 'LOW') return activeEmails.filter(e => e.priority === 'LOW' && !e.isMarketing);
    // ALL: show everything except marketing and snoozed
    return activeEmails.filter(e => !e.isMarketing);
  }, [emails, sentEmails, filter]);

  const threads = useMemo(() => groupIntoThreads(filtered), [filtered]);

  const emailCounts = useMemo(() => {
    const now = new Date();
    const snoozedEmails = emails.filter(e => e.snoozedUntil && new Date(e.snoozedUntil) > now);
    const active = emails.filter(e => !e.isComplete && (!e.snoozedUntil || new Date(e.snoozedUntil) <= now));
    return {
      ALL: active.filter(e => !e.isMarketing).length,
      HIGH: active.filter(e => e.priority === 'HIGH' && !e.isMarketing).length,
      MEDIUM: active.filter(e => e.priority === 'MEDIUM' && !e.isMarketing).length,
      LOW: active.filter(e => e.priority === 'LOW' && !e.isMarketing).length,
      MARKETING: active.filter(e => e.isMarketing).length,
      CALENDAR: active.filter(isCalendarEmail).length,
      SNOOZED: snoozedEmails.length,
      COMPLETE: emails.filter(e => e.isComplete).length,
      SENT: sentEmails.length,
    };
  }, [emails, sentEmails]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) ||
        (e.target as HTMLElement)?.isContentEditable;

      // Always allow Escape
      if (e.key === 'Escape') {
        if (showShortcutsHelp) { setShowShortcutsHelp(false); return; }
        if (composing) return;
        if (searchResults !== null) { clearSearch(); return; }
        setSelected(null);
        if (isMobile) setMobileView('list');
        return;
      }

      // '?' opens help overlay
      if (e.key === '?' && !isTyping) {
        e.preventDefault();
        setShowShortcutsHelp(s => !s);
        return;
      }

      if (isTyping || composing || showShortcutsHelp) return;

      const displayList = searchResults !== null ? searchResults : threads;

      switch (e.key) {
        case 'j':
        case 'J': {
          e.preventDefault();
          if (!displayList.length) break;
          const idx = selected ? displayList.findIndex(em => em.id === selected.id) : -1;
          const next = displayList[Math.min(idx + 1, displayList.length - 1)];
          if (next) handleSelectEmail(next);
          break;
        }
        case 'k':
        case 'K': {
          e.preventDefault();
          if (!displayList.length) break;
          const idx = selected ? displayList.findIndex(em => em.id === selected.id) : 0;
          const prev = displayList[Math.max(idx - 1, 0)];
          if (prev) handleSelectEmail(prev);
          break;
        }
        case 'Enter': {
          if (!selected && displayList.length) {
            e.preventDefault();
            handleSelectEmail(displayList[0]);
          }
          break;
        }
        case 'r':
        case 'R': {
          if (selected) {
            e.preventDefault();
            setReplyTo(selected);
            setComposing(true);
          }
          break;
        }
        case 'c':
        case 'C': {
          e.preventDefault();
          setReplyTo(null);
          setComposing(true);
          break;
        }
        case 'e':
        case 'E': {
          if (selected) {
            e.preventDefault();
            completeEmail(selected, true);
          }
          break;
        }
        case 'u':
        case 'U': {
          if (selected) {
            e.preventDefault();
            const newRead = !selected.isRead;
            updateEmail({ id: selected.id, isRead: newRead });
            fetch('/api/email/read', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ emailId: selected.id, isRead: newRead }),
            });
          }
          break;
        }
        case '#': {
          if (selected) {
            e.preventDefault();
            deleteEmail(selected);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, threads, searchResults, composing, showShortcutsHelp, isMobile, clearSearch, completeEmail, deleteEmail, updateEmail, handleSelectEmail]);

  // Undo send helpers
  const executeSend = async (payload: { to: string; subject: string; body: string; fromEmail: string; threadId?: string; replyAll?: boolean }) => {
    try {
      await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error('Send failed:', e);
    }
  };

  const queueSend = (payload: { to: string; subject: string; body: string; fromEmail: string; threadId?: string; replyAll?: boolean }) => {
    if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
    setPendingSend(payload);
    setSendCountdown(15);
    let remaining = 15;
    sendIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setSendCountdown(remaining);
      if (remaining <= 0 && sendIntervalRef.current) clearInterval(sendIntervalRef.current);
    }, 1000);
    sendTimerRef.current = setTimeout(() => {
      executeSend(payload);
      setPendingSend(null);
      setSendCountdown(0);
    }, 15000);
  };

  const cancelSend = () => {
    if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
    setPendingSend(null);
    setSendCountdown(0);
  };

  const sendNow = () => {
    if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
    if (pendingSend) executeSend(pendingSend);
    setPendingSend(null);
    setSendCountdown(0);
  };

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
          filter={filter}
          setFilter={(f) => { setFilter(f); if (isMobile) setSidebarOpen(false); if (f === 'SENT') loadSentEmails(); }}
          onCompose={() => { setReplyTo(null); setComposing(true); setSidebarOpen(false); }}
          emailCounts={emailCounts}
          onForceRefresh={() => syncFromGmail(true, undefined, true)}
          onShowShortcuts={() => setShowShortcutsHelp(true)}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Thin syncing progress bar (Superhuman-style) */}
        {isSyncing && (
          <div style={{ height: 2, background: 'var(--bg)', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{
              position: 'absolute', top: 0, left: '-100%', height: '100%', width: '60%',
              background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
              animation: 'syncBar 1.4s ease-in-out infinite',
            }} />
          </div>
        )}
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
              emails={searchResults !== null ? searchResults : threads}
              loading={loading || (isSyncing && emails.length === 0) || isSearching}
              selected={selected}
              onSelect={handleSelectEmail}
              onRefresh={() => syncFromGmail(true, undefined, true)}
              isMobile={isMobile} onMenuOpen={() => setSidebarOpen(true)}
              loadingMore={loadingMore} hasMore={searchResults !== null ? false : !!nextPageToken}
              onLoadMore={() => syncFromGmail(true, nextPageToken!)}
              onEmailUpdate={updateEmail}
              onBulkUpdate={bulkUpdateEmails}
              onMarkComplete={(email) => completeEmail(email, true)}
              onUndoComplete={(email) => completeEmail(email, false)}
              isCompleteFilter={filter === 'COMPLETE'}
              onDelete={deleteEmail}
              onReply={(email) => { handleSelectEmail(email); setReplyTo(email); setComposing(true); }}
              onReplyAll={(email) => { handleSelectEmail(email); setReplyTo({ ...email, replyAll: true } as Email); setComposing(true); }}
              searchQuery={searchQuery}
              onSearch={handleSearch}
              onClearSearch={clearSearch}
              isSearchMode={searchResults !== null}
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
              onMarkComplete={(email) => completeEmail(email, true)}
              onDelete={deleteEmail}
              onSnooze={snoozeEmail}
            />
          </div>
        </div>
      </div>

      {composing && (
        <ComposeModal
          accounts={accounts} replyTo={replyTo}
          onClose={() => { setComposing(false); setReplyTo(null); }}
          apiUrl=""
          onSendQueued={queueSend}
        />
      )}

      {/* Undo Send Toast */}
      {pendingSend && (
        <div
          style={{
            position: 'fixed', bottom: 28, left: 28,
            zIndex: 9999, display: 'flex', alignItems: 'center', gap: 0,
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: '0 4px 24px rgba(0,0,0,0.28)',
            overflow: 'hidden', fontSize: 13,
          }}
          onMouseEnter={e => {
            const btn = e.currentTarget.querySelector<HTMLElement>('[data-sendnow]');
            const div = e.currentTarget.querySelector<HTMLElement>('[data-sendnow-divider]');
            if (btn) { btn.style.width = 'auto'; btn.style.padding = '11px 16px'; btn.style.opacity = '1'; }
            if (div) div.style.width = '1px';
          }}
          onMouseLeave={e => {
            const btn = e.currentTarget.querySelector<HTMLElement>('[data-sendnow]');
            const div = e.currentTarget.querySelector<HTMLElement>('[data-sendnow-divider]');
            if (btn) { btn.style.width = '0'; btn.style.padding = '11px 0'; btn.style.opacity = '0'; }
            if (div) div.style.width = '0';
          }}
        >
          {/* Countdown bar */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0,
            height: 2, background: 'var(--accent)',
            width: `${(sendCountdown / 15) * 100}%`,
            transition: 'width 1s linear',
          }} />
          <div style={{ padding: '11px 16px', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Sending in {sendCountdown}s…
          </div>
          <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch' }} />
          <button
            onClick={cancelSend}
            style={{
              padding: '11px 16px', color: 'var(--text)', fontWeight: 600,
              background: 'transparent', fontSize: 13,
              transition: 'background 0.15s', whiteSpace: 'nowrap',
            }}
            onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-3)')}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
          >
            Undo
          </button>
          {/* Send Now — hidden until hover */}
          <div data-sendnow-divider style={{ width: 0, background: 'var(--border)', alignSelf: 'stretch', transition: 'width 0.2s' }} />
          <button
            data-sendnow
            onClick={sendNow}
            style={{
              width: 0, padding: '11px 0', opacity: 0, overflow: 'hidden',
              color: 'var(--accent)', fontWeight: 600,
              background: 'transparent', fontSize: 13,
              transition: 'width 0.2s, padding 0.2s, opacity 0.2s', whiteSpace: 'nowrap',
            }}
            onMouseOver={e => (e.currentTarget.style.background = 'rgba(212,168,83,0.08)')}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
          >
            Send Now ⚡
          </button>
        </div>
      )}

      {showShortcutsHelp && (
        <KeyboardShortcutsHelp onClose={() => setShowShortcutsHelp(false)} />
      )}
    </div>
  );
}

export default function Home() {
  return <AccountProvider><InboxApp /></AccountProvider>;
}
