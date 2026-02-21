'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase';

export default function SupabaseCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Signing you in...');

  useEffect(() => {
    const supabase = createClient();

    async function handleCallback() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        setStatus('Error: ' + error);
        setTimeout(() => router.push('/login'), 2000);
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setStatus('Auth error: ' + exchangeError.message);
          setTimeout(() => router.push('/login'), 2000);
          return;
        }
        router.push('/');
        return;
      }

      // Fallback: check existing session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/');
        return;
      }

      // Listen for sign in
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          subscription.unsubscribe();
          router.push('/');
        }
      });

      setTimeout(() => {
        setStatus('Something went wrong. Redirecting to login...');
        setTimeout(() => router.push('/login'), 1500);
      }, 8000);
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
    }}>
      <div style={{ fontSize: 32 }}>✉</div>
      <div>{status}</div>
    </div>
  );
}
