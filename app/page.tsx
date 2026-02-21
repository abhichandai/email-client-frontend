'use client';

import { useState, useEffect, useCallback } from 'react';
import { AccountProvider, useAccounts } from './context/accounts';
import Sidebar from './components/Sidebar';
import EmailList from './components/EmailList';
import EmailDetail from './components/EmailDetail';
import ComposeModal from './components/ComposeModal';
import { Email } from './types';
import { createClient } from '../lib/supabase';

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
  const [userId, setUserId] = useState<string | null>(null);
  const [rules, setRules] = useState<PriorityRules>({
    importantSenders: [], importantDomains: [], importantKeywords: [], unimportantSenders: [],
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; email: Email } | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Get userId from Supabase session
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setUserId(session.user.id);
    });
  }, []);

  // Load rules from DB
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/rules?userId=${userId}`)
      .then(r => r.json())
      .then(data => { if (data.rules) setRules(data.rules); });
  }, [userId]);

  const fetchEmails = useCallback(async (opts: { forceSync?: boolean; pageToken?: string } = {}) => {
    if (!accounts.length || !userId) return;
    const hasTokens = accounts.every(a => a.tokens?.access_token);
    if (!hasTokens) { setError('No access token. Please sign out and sign in again.'); return; }

    opts.pageToken ? setLoadingMore(true) : setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts, userId, pageToken: opts.pageToken, forceSync: opts.forceSync }),
      });
      const data = await res.json();
      if (data.error) {
        setError('Error: ' + data.error);
      } else {
        if (opts.pageToken) {
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
  }, [accounts, userId]);

  useEffect(() => { if (userId && accounts.length) fetchEmails(); }, [userId, accounts.length]);

  const saveRules = async (newRules: PriorityRules) => {
    setRules(newRules);
    if (userId) {
      await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, rules: newRules }),
      });
    }
  };

  const handlePriorityOverride = async (email: Email, priority: string) => {
    if (!userId) return;
    const senderEmail = email.from?.match(/<(.+)>/)?.[1] || email.from || '';

    // Optimistic update
    setEmails(prev => prev.map(e =>
      e.id === email.id ? { ...e, priority } : e
    ));
    if (selected?.id === email.id) setSelected({ ...email, priority });

    await fetch('/api/email-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_priority_override', emailId: email.id, userId, value: priority, senderEmail }),
    });
  };

  const handleMarkRead = async (email: Email, isRead: boolean) => {
    if (!userId) return;
    const accountToken = accounts.find(a => a.email === email.accountEmail)?.tokens?.access_token;

    // Optimistic update
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isRead } : e));
    if (selected?.id === email.id) setSelected({ ...email, isRead });

    await fetch('/api/email-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: isRead ? 'mark_read' : 'mark_unread',
        emailId: email.id, userId, accountToken,
      }),
    });
  };

  const handleSelectEmail = (email: Email) => {
    setSelected(email);
    if (isMobile) setMobileView('detail');
    // Auto-mark as read
    if (!email.isRead) handleMarkRead(email, true);
  };

  const filtered = filter === 'ALL' ? emails : emails.filter(e =>
    (e.priority_override || e.priority) === filter
  );

  // Close context menu on click
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', position: 'relative' }}>

      {/* Context menu */}
      {contextMenu && (
        <div style={{
          position: 'fixed', left: contextMenu.x, top: contextMenu.y,
          background: 'var(--bg-3)', border: '1px solid var(--border)',
          borderRadius: 8, zIndex: 200, minWidth: 180,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
        }} onClick={e => e.stopPropagation()}>
          {[
            { label: '🔴 Mark as Priority', value: 'HIGH' },
            { label: '🟡 Mark as Important', value: 'MEDIUM' },
            { label: '⚫ Mark as Low', value: 'LOW' },
          ].map(opt => (
            <button key={opt.value} onClick={() => { handlePriorityOverride(contextMenu.email, opt.value); setContextMenu(null); }}
              style={{ width: '100%', padding: '10px 16px', textAlign: 'left', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)' }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-2)')}
              onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
            >{opt.label}</button>
          ))}
          <button onClick={() => { handleMarkRead(contextMenu.email, !contextMenu.email.isRead); setContextMenu(null); }}
            style={{ width: '100%', padding: '10px 16px', textAlign: 'left', fontSize: 13, color: 'var(--text)' }}
            onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-2)')}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
          >{contextMenu.email.isRead ? '○ Mark as Unread' : '● Mark as Read'}</button>
        </div>
      )}

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
      )}

      <div style={{
        position: isMobile ? 'fixed' : 'relative',
        left: isMobile ? (sidebarOpen ? 0 : -280) : 'auto',
        top: 0, bottom: 0, width: isMobile ? 260 : 'auto',
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
            HIGH: emails.filter(e => (e.priority_override || e.priority) === 'HIGH').length,
            MEDIUM: emails.filter(e => (e.priority_override || e.priority) === 'MEDIUM').length,
            LOW: emails.filter(e => (e.priority_override || e.priority) === 'LOW').length,
          }}
          rules={rules}
          onSaveRules={saveRules}
          onForceSync={() => fetchEmails({ forceSync: true })}
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
              onSelect={handleSelectEmail}
              onRefresh={() => fetchEmails()}
              isMobile={isMobile}
              onMenuOpen={() => setSidebarOpen(true)}
              loadingMore={loadingMore}
              hasMore={!!nextPageToken}
              onLoadMore={() => fetchEmails({ pageToken: nextPageToken! })}
              onContextMenu={(e, email) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, email });
              }}
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
              onPriorityChange={handlePriorityOverride}
              onMarkRead={handleMarkRead}
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
