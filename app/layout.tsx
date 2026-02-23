import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from './context/theme';

export const metadata: Metadata = {
  title: 'FocusKeep — AI Priority Inbox',
  description: 'Your AI-powered priority inbox by FocusKeep',
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
