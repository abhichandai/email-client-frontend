'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase';

export default function SupabaseCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Signing you in...');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    const supabase = createClient();

    async function handleCallback() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      // Show what params we got for debugging
      setDetail(`code: ${code ? 'yes' : 'no'} | error: ${error || 'none'}`);

      if (error) {
        setStatus(`Google error: ${errorDescription || error}`);
        setTimeout(() => router.push('/login'), 3000);
        return;
      }

      if (code) {
        setStatus('Exchanging code...');
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setStatus('Exchange failed: ' + exchangeError.message);
          setDetail(exchangeError.message);
          setTimeout(() => router.push('/login'), 4000);
          return;
        }
        if (data.session) {
          setStatus('Success! Loading inbox...');
          router.push('/');
          return;
        }
      }

      // No code — check existing session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/');
        return;
      }

      setStatus('No auth code found.');
      setDetail('URL: ' + window.location.href.substring(0, 100));
      setTimeout(() => router.push('/login'), 4000);
    }

    handleCallback();
  }, [router]);

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
      padding: 20,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 32 }}>✉</div>
      <div>{status}</div>
      {detail && <div style={{ fontSize: 11, color: '#444', maxWidth: 320, wordBreak: 'break-all' }}>{detail}</div>}
    </div>
  );
}
