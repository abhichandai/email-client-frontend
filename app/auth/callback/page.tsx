'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AccountProvider, useAccounts } from '../../context/accounts';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function CallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addAccount } = useAccounts();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const provider = searchParams.get('provider') as 'gmail' | 'outlook';
    const tokensRaw = searchParams.get('tokens');
    const accountId = searchParams.get('accountId') || Date.now().toString();

    if (!provider || !tokensRaw) {
      setStatus('Error: missing parameters');
      return;
    }

    try {
      const tokens = JSON.parse(decodeURIComponent(tokensRaw));

      fetch(`${API}/auth/${provider}/userinfo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens }),
      })
        .then((r) => r.json())
        .then((info) => {
          addAccount({
            id: accountId,
            provider,
            email: info.email || info.account?.username || 'unknown',
            tokens,
          });
          setStatus('Account connected! Redirecting...');
          setTimeout(() => router.push('/'), 800);
        })
        .catch(() => {
          addAccount({ id: accountId, provider, email: 'Account', tokens });
          setTimeout(() => router.push('/'), 800);
        });
    } catch {
      setStatus('Error processing authentication');
    }
  }, [searchParams, addAccount, router]);

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      color: '#888',
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 14,
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ fontSize: 32 }}>✉</div>
      <div>{status}</div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <AccountProvider>
      <Suspense fallback={
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#888' }}>
          Loading...
        </div>
      }>
        <CallbackInner />
      </Suspense>
    </AccountProvider>
  );
}
