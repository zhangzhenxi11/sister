import { useState, useEffect } from 'react';
import { LogIn, Loader2 } from 'lucide-react';
import { useAuthStore, sendSmsCode, verifySmsCode } from '@/stores/authStore';

/** 手机号 + 验证码登录卡片（Analyze / Profile 共用） */
export default function LoginCard() {
  const setAuth = useAuthStore(s => s.setAuth);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'send' | 'login' | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSend = async () => {
    setError('');
    setBusy('send');
    try {
      const data = await sendSmsCode(phone);
      setCountdown(60);
      if (data.devCode) setDevCode(data.devCode);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleLogin = async () => {
    setError('');
    setBusy('login');
    try {
      const data = await verifySmsCode(phone, code);
      setAuth(data.token, data.user);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg space-y-4">
      <div className="flex items-center gap-2 text-gray-800">
        <LogIn className="w-5 h-5 text-pink-500" />
        <h2 className="font-semibold">手机号登录</h2>
      </div>
      <p className="text-xs text-gray-400">登录后分析记录自动同步到账号；不登录也可匿名使用</p>
      <input
        type="tel"
        inputMode="numeric"
        placeholder="手机号"
        value={phone}
        onChange={e => setPhone(e.target.value)}
        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
      />
      <div className="flex gap-2">
        <input
          type="tel"
          inputMode="numeric"
          placeholder="6 位验证码"
          value={code}
          onChange={e => setCode(e.target.value)}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
        />
        <button
          onClick={handleSend}
          disabled={busy === 'send' || countdown > 0 || phone.length !== 11}
          className="px-4 rounded-xl bg-pink-100 text-pink-600 text-sm font-medium disabled:opacity-40 whitespace-nowrap"
        >
          {countdown > 0 ? `${countdown}s` : '发送验证码'}
        </button>
      </div>
      {devCode && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">开发模式验证码：{devCode}</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        onClick={handleLogin}
        disabled={busy === 'login' || code.length !== 6}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-medium disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {busy === 'login' && <Loader2 className="w-4 h-4 animate-spin" />}
        登录
      </button>
    </div>
  );
}
