'use client';

import { useState, useEffect, useCallback } from 'react';
import { AccountProvider, useAccounts } from './context/accounts';
import Sidebar from './components/Sidebar';
import EmailList from './components/EmailList';
import EmailDetail from './components/EmailDetail';
import ComposeModal from './components/ComposeModal';
import { Email } from './types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function InboxApp() {
  const { accounts } = useAccounts();
  const [emails, setEmails] = useState<Email[]>([]);
  const [selected, setSelected] = useState<Email | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [composing, setComposing] = useState(false);
  const [replyTo, setReplyTo] = useState<Email | null>(null);

  const fetchEmails = useCallback(async () => {
    if (!accounts.length) return;
    setLoading(true);
    try {
      const res = await fetch(API + '/emails/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts }),
      });
      const data = await res.json();
      setEmails(data.emails || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [accounts]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const filtered = filter === 'ALL' ? emails : emails.filter((e) => e.priority === filter);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar
        accounts={accounts}
        filter={filter}
        setFilter={setFilter}
        onCompose={() => { setReplyTo(null); setComposing(true); }}
        emailCounts={{
          ALL: emails.length,
          HIGH: emails.filter((e) => e.priority === 'HIGH').length,
          MEDIUM: emails.filter((e) => e.priority === 'MEDIUM').length,
          LOW: emails.filter((e) => e.priority === 'LOW').length,
        }}
      />
      <EmailList
        emails={filtered}
        loading={loading}
        selected={selected}
        onSelect={setSelected}
        onRefresh={fetchEmails}
      />
      <EmailDetail
        email={selected}
        onReply={(email) => { setReplyTo(email); setComposing(true); }}
        onClose={() => setSelected(null)}
      />
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
