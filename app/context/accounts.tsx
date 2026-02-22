'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '../../lib/supabase';

export interface Account {
  id: string;
  provider: 'gmail' | 'outlook';
  email: string;
  tokens: { access_token?: string; refresh_token?: string; [key: string]: unknown };
}

interface AccountContextType {
  accounts: Account[];
  addAccount: (account: Account) => void;
  removeAccount: (id: string) => void;
}

const AccountContext = createContext<AccountContextType>({
  accounts: [],
  addAccount: () => {},
  removeAccount: () => {},
});

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    const supabase = createClient();

    async function initAccounts() {
      // Check if we just came back from OAuth with tokens in URL
      const params = new URLSearchParams(window.location.search);
      const pt = params.get('pt');
      const prt = params.get('prt');
      const ue = params.get('ue');
      const uid = params.get('uid');

      if (pt && ue && uid) {
        // Fresh login - store the Gmail tokens
        const gmailAccount: Account = {
          id: uid,
          provider: 'gmail',
          email: ue,
          tokens: {
            access_token: pt,
            refresh_token: prt || '',
            token_type: 'Bearer',
          },
        };
        setAccounts([gmailAccount]);
        localStorage.setItem('email-accounts', JSON.stringify([gmailAccount]));

        // Clean tokens from URL without reload
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
        return;
      }

      // Try to get token from active Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.provider_token && session.user?.email) {
        const gmailAccount: Account = {
          id: session.user.id,
          provider: 'gmail',
          email: session.user.email,
          tokens: {
            access_token: session.provider_token,
            refresh_token: session.provider_refresh_token || '',
            token_type: 'Bearer',
          },
        };
        setAccounts([gmailAccount]);
        localStorage.setItem('email-accounts', JSON.stringify([gmailAccount]));
        return;
      }

      // Fall back to localStorage for returning users
      const stored = localStorage.getItem('email-accounts');
      if (stored) setAccounts(JSON.parse(stored));
    }

    initAccounts();
  }, []);

  const addAccount = (account: Account) => {
    setAccounts((prev) => {
      const updated = [...prev.filter((a) => a.id !== account.id), account];
      localStorage.setItem('email-accounts', JSON.stringify(updated));
      return updated;
    });
  };

  const removeAccount = (id: string) => {
    setAccounts((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      localStorage.setItem('email-accounts', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AccountContext.Provider value={{ accounts, addAccount, removeAccount }}>
      {children}
    </AccountContext.Provider>
  );
}

export const useAccounts = () => useContext(AccountContext);
