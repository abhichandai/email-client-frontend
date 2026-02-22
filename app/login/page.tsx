'use client';

import { useState } from 'react';
import { createClient } from '../../lib/supabase';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const signInWithGoogle = async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://app.mailmfer.com/auth/confirm',
        scopes: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/contacts.readonly',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      fontFamily: "'DM Sans', sans-serif",
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        padding: '48px 40px',
        background: '#111',
        border: '1px solid #222',
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✉</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
            mail<span style={{ color: '#d4a853' }}>mfer</span>
          </div>
          <div style={{ fontSize: 13, color: '#555', marginTop: 6 }}>Your AI-powered priority inbox</div>
        </div>

        <div style={{ width: '100%', height: 1, background: '#1a1a1a' }} />

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 6 }}>Welcome back</div>
          <div style={{ fontSize: 13, color: '#555' }}>Sign in with Google to access your inbox</div>
        </div>

        <button
          onClick={signInWithGoogle}
          disabled={loading}
          style={{
            width: '100%',
            padding: '13px 20px',
            background: loading ? '#1a1a1a' : '#fff',
            color: '#111',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {loading ? (
            <span style={{ color: '#555' }}>Redirecting...</span>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>

        {error && <div style={{ color: '#e74c3c', fontSize: 13, textAlign: 'center' }}>{error}</div>}

        <div style={{ fontSize: 12, color: '#333', textAlign: 'center', lineHeight: 1.6 }}>
          By signing in, you grant mailmfer access to read and send emails on your behalf.
        </div>
      </div>
    </div>
  );
}
