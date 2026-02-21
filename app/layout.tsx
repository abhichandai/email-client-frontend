import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Inbox — Priority Email',
  description: 'Your AI-powered priority inbox',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
