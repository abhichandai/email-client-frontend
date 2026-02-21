'use client';

import { useState, useEffect, useCallback } from 'react';
import { AccountProvider, useAccounts } from './context/accounts';
import Sidebar from './components/Sidebar';
import EmailList from './components/EmailList';
import EmailDetail from './components/EmailDetail';
import ComposeModal from './components/ComposeModal';
import { Email } from './types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type MobileView = 'sidebar' | 'list' | 'detail';

function InboxApp() {
  const { accounts } = useAccounts();
  const [emails, setEmails] = useState<Email[]>([]);
  const [selected, setSelected] = useState<Email | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [composing, setComposing] = useState(false);
  const [replyTo, setReplyTo] = useState<Email | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('list');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const fetchEmails = useCallback(async () => {
    if (!accounts.length) {
      setError('No accounts connected.');
      return;
    }
    // Check tokens exist
    const hasTokens = accounts.every(a => a.tokens?.access_token);
    if (!hasTokens) {
      setError('Account connected but no access token found. Please sign out and sign in again.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(API + '/emails/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts }),
      });
      const data = await res.json();
      if (data.error) {
        setError('Backend error: ' + data.error);
      } else {
        setEmails(data.emails || []);
      }
    } catch (e) {
      setError('Could not reach backend: ' + String(e));
    } finally {
      setLoading(false);
    }
  }, [accounts]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const filtered = filter === 'ALL' ? emails : emails.filter((e) => e.priority === filter);

  const handleSelectEmail = (email: Email) => {
    setSelected(email);
    if (isMobile) setMobileView('detail');
  };

  const handleCloseDetail = () => {
    setSelected(null);
    if (isMobile) setMobileView('list');
  };

  const handleSetFilter = (f: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW') => {
    setFilter(f);
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', position: 'relative' }}>

      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
        />
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
          setFilter={handleSetFilter}
          onCompose={() => { setReplyTo(null); setComposing(true); setSidebarOpen(false); }}
          emailCounts={{
            ALL: emails.length,
            HIGH: emails.filter((e) => e.priority === 'HIGH').length,
            MEDIUM: emails.filter((e) => e.priority === 'MEDIUM').length,
            LOW: emails.filter((e) => e.priority === 'LOW').length,
          }}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Error banner */}
        {error && (
          <div style={{
            padding: '10px 20px',
            background: 'rgba(224,92,92,0.1)',
            borderBottom: '1px solid rgba(224,92,92,0.2)',
            fontSize: 12,
            color: '#e05c5c',
          }}>
            {error}
          </div>
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
              onRefresh={fetchEmails}
              isMobile={isMobile}
              onMenuOpen={() => setSidebarOpen(true)}
            />
          </div>

          <div style={{
            display: isMobile && mobileView !== 'detail' ? 'none' : 'flex',
            flex: 1,
            overflow: 'hidden',
          }}>
            <EmailDetail
              email={selected}
              onReply={(email) => { setReplyTo(email); setComposing(true); }}
              onClose={handleCloseDetail}
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
          apiUrl={API}
        />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <AccountProvider>
      <InboxApp />
    </AccountProvider>
  );
}
