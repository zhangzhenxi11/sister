import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  phone: string;
  nickname: string;
  createdAt: string;
  lastLoginAt: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    { name: 'emotion-ai-auth' }
  )
);

/** 带 Bearer 头的 fetch 封装：未登录时等同普通 fetch */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}

interface SendCodeResult {
  ttlSec: number;
  resent: boolean;
  devCode?: string;
}

export async function sendSmsCode(phone: string): Promise<SendCodeResult> {
  const res = await fetch('/api/auth/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || '发送失败');
  }
  return json.data as SendCodeResult;
}

export async function verifySmsCode(phone: string, code: string): Promise<{ token: string; user: AuthUser; isNewUser: boolean }> {
  const res = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || '验证失败');
  }
  return json.data as { token: string; user: AuthUser; isNewUser: boolean };
}
