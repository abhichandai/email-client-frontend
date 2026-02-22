import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from './context/theme';

export const metadata: Metadata = {
  title: 'Inbox — Priority Email',
  description: 'Your AI-powered priority inbox',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
