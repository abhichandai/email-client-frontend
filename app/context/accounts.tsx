'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
    const stored = localStorage.getItem('email-accounts');
    if (stored) setAccounts(JSON.parse(stored));
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
