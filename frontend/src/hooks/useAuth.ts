import { useCallback, useEffect, useState } from 'react';
import { AUTH_SESSION_EXPIRED_EVENT, clearAuth, getAuthMeta, getCurrentUser, login, register } from '../lib/api';
import type { AuthUser } from '../types';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => getCurrentUser());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const meta = getAuthMeta();
    if (!meta) {
      logout();
      return;
    }

    const remainingMs = meta.accessTokenExpiresAt - Date.now();
    if (remainingMs <= 0) {
      logout();
      return;
    }

    const timerId = window.setTimeout(() => {
      logout();
    }, remainingMs);

    const handleSessionExpired = () => {
      setUser(null);
      setError(null);
    };

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [logout, user]);

  const loginWithPassword = async (payload: { username: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await login(payload);
      setUser(response.user);
      return response.user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const registerWithPassword = async (payload: {
    username: string;
    email: string;
    password: string;
    fullName?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await register(payload);
      setUser(response.user);
      return response.user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Register failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProfileInfo = async (payload: { fullName: string; password?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const { updateProfile } = await import('../lib/api');
      const updatedUser = await updateProfile(payload);
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    error,
    loginWithPassword,
    registerWithPassword,
    updateProfileInfo,
    logout,
  };
}
