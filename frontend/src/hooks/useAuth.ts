import { useState } from 'react';
import { clearAuth, getCurrentUser, login, register } from '../lib/api';
import type { AuthUser } from '../types';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => getCurrentUser());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const logout = () => {
    clearAuth();
    setUser(null);
    setError(null);
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
