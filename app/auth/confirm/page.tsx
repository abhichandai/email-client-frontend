'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase';

export default function SupabaseCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Check if already signed in (session exists from OAuth redirect)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/');
        return;
      }
    });

    // Also listen for the sign-in event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.push('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#0a0a0a', color: '#888',
      fontFamily: 'DM Sans, sans-serif', fontSize: 14, flexDirection: 'column', gap: 12
    }}>
      <div style={{ fontSize: 32 }}>✉</div>
      <div>Signing you in...</div>
    </div>
  );
}
