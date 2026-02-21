'use client';

import { useEffect } from 'react';

export default function LoginPage() {
  useEffect(() => {
    window.location.href = 'https://mailmfer.com';
  }, []);

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
    }}>
      Redirecting...
    </div>
  );
}
