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
      // Handle hash-based implicit flow (#access_token=...)
      if (window.location.hash) {
        const { data, error } = await supabase.auth.getSession();
        if (data.session) {
          router.push('/');
          return;
        }
        if (error) {
          setStatus('Auth error: ' + error.message);
          setTimeout(() => router.push('/login'), 3000);
          return;
        }
        // Give it a moment for Supabase to process the hash
        await new Promise(r => setTimeout(r, 1000));
        const { data: data2 } = await supabase.auth.getSession();
        if (data2.session) {
          router.push('/');
          return;
        }
      }

      // Handle PKCE code flow (?code=...)
      const code = new URL(window.location.href).searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) { router.push('/'); return; }
        setStatus('Exchange error: ' + error.message);
        setTimeout(() => router.push('/login'), 3000);
        return;
      }

      // Listen for auth state change (catches both flows)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          subscription.unsubscribe();
          router.push('/');
        }
      });

      setTimeout(() => {
        setStatus('Timed out. Try again.');
        setTimeout(() => router.push('/login'), 2000);
      }, 6000);
    }

    handleCallback();
  }, [router]);

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0a', color: '#888', fontFamily: 'DM Sans, sans-serif',
      fontSize: 14, flexDirection: 'column', gap: 12, padding: 20, textAlign: 'center',
    }}>
      <div style={{ fontSize: 32 }}>✉</div>
      <div>{status}</div>
    </div>
  );
}
