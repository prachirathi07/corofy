'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Hardcoded credentials
const HARDCODED_CREDENTIALS = {
  'corofy.marketing@gmail.com': 'Corofy@3636$$'
};

interface AuthContextType {
  isAuthenticated: boolean;
  user: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('auth_user');
    const savedAuth = localStorage.getItem('auth_authenticated');
    
    if (savedUser && savedAuth === 'true') {
      setUser(savedUser);
      setIsAuthenticated(true);
    }
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    console.log('Auth: Login attempt for user:', username);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (HARDCODED_CREDENTIALS[username as keyof typeof HARDCODED_CREDENTIALS] === password) {
      console.log('Auth: Login successful for user:', username);
      setUser(username);
      setIsAuthenticated(true);
      
      // Save to localStorage for persistence
      localStorage.setItem('auth_user', username);
      localStorage.setItem('auth_authenticated', 'true');
      console.log('Auth: User state updated, isAuthenticated:', true);
    } else {
      console.log('Auth: Invalid credentials for user:', username);
      throw new Error('Invalid credentials');
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    
    // Clear localStorage
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_authenticated');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
