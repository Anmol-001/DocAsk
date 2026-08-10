"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthService } from '@/lib/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  login: (token: string, userId: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  useEffect(() => {
    // Check initial state from sessionStorage
    setIsAuthenticated(AuthService.isAuthenticated());
    setUserId(AuthService.getUserId());
    setIsInitialized(true);

    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setUserId(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = (token: string, newUserId: string) => {
    AuthService.setToken(token, newUserId);
    setIsAuthenticated(true);
    setUserId(newUserId);
  };

  const logout = () => {
    AuthService.clearToken();
    setIsAuthenticated(false);
    setUserId(null);
  };

  if (!isInitialized) {
    return null; // Avoid hydration mismatch
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, userId, login, logout }}>
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
