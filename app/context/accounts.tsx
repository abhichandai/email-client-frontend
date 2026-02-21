'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '../../lib/supabase';

export interface Account {
  id: string;
  provider: 'gmail' | 'outlook';
  email: string;
  tokens: Record<string, unknown>;
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

    // Auto-connect Gmail from Supabase Google session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.provider_token && session.user?.email) {
        const gmailAccount: Account = {
          id: session.user.id,
          provider: 'gmail',
          email: session.user.email,
          tokens: {
            access_token: session.provider_token,
            refresh_token: session.provider_refresh_token,
            token_type: 'Bearer',
          },
        };
        setAccounts([gmailAccount]);
        localStorage.setItem('email-accounts', JSON.stringify([gmailAccount]));
      } else {
        const stored = localStorage.getItem('email-accounts');
        if (stored) setAccounts(JSON.parse(stored));
      }
    });
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
