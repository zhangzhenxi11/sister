import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ImagePlus, ClipboardPaste, X, LogIn, LogOut, Loader2,
  Check, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, ScanLine,
} from 'lucide-react';
import { useAuthStore, sendSmsCode, verifySmsCode, authFetch } from '@/stores/authStore';
import { uploadScreenshot } from '@/lib/imageCompress';
import type { AnalysisResult } from '../../api/services/analysis/types';

/* ---------------- 策略配色 ---------------- */
const STRATEGY_STYLES: Record<string, { badge: string; bg: string; label: string }> = {
  advance: { badge: 'bg-emerald-100 text-emerald-700', bg: 'from-emerald-50 to-teal-50 border-emerald-200', label: '进攻' },
  hold: { badge: 'bg-amber-100 text-amber-700', bg: 'from-amber-50 to-yellow-50 border-amber-200', label: '观察' },
  retreat_unload: { badge: 'bg-rose-100 text-rose-700', bg: 'from-rose-50 to-pink-50 border-rose-200', label: '退 · 卸防' },
  retreat_freeze: { badge: 'bg-red-100 text-red-700', bg: 'from-red-50 to-rose-50 border-red-200', label: '退 · 冷冻' },
};

const DEFENSE_LABELS: Record<string, string> = { low: '防御低', medium: '防御中', high: '防御高' };

/* ---------------- 登录卡片 ---------------- */
function LoginCard() {
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

/* ---------------- 结果视图 ---------------- */
function ResultView({ result }: { result: AnalysisResult }) {
  const [feedback, setFeedback] = useState<Record<number, 'adopted' | 'rejected'>>({});
  const [showDialog, setShowDialog] = useState(false);
  const style = STRATEGY_STYLES[result.decision.strategy] || STRATEGY_STYLES.hold;

  const submitFeedback = async (index: number, outcome: 'adopted' | 'rejected') => {
    try {
      const res = await authFetch(`/api/analyze/${result.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionIndex: index, outcome }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedback(f => ({ ...f, [index]: outcome }));
      }
    } catch {
      /* 网络异常时静默，不打断阅读 */
    }
  };

  return (
    <div className="space-y-4">
      {/* 策略决策 */}
      <div className={`rounded-2xl border bg-gradient-to-br p-5 ${style.bg}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${style.badge}`}>
            {result.decision.strategyLabel}
          </span>
          <span className="text-[10px] text-gray-400">规则 {result.decision.ruleId}</span>
        </div>
        <p className="text-gray-800 font-medium">{result.decision.action}</p>
        {result.decision.reason.map((r, i) => (
          <p key={i} className="text-xs text-gray-500 mt-1">· {r}</p>
        ))}
      </div>

      {/* 阶段 + 侧写 */}
      <div className="bg-white rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">关系阶段</h3>
          <span className="text-sm font-medium text-purple-600">{result.stage}</span>
        </div>
        <p className="text-xs text-gray-500">{result.stageReason}</p>
        <hr className="border-gray-100" />
        <h3 className="font-semibold text-gray-800">对方侧写</h3>
        <div className="flex flex-wrap gap-1.5">
          {result.profile.traits.map(t => (
            <span key={t} className="text-xs bg-purple-50 text-purple-600 px-2.5 py-1 rounded-full">{t}</span>
          ))}
          <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">
            {DEFENSE_LABELS[result.profile.defenseLevel] || result.profile.defenseLevel}
          </span>
        </div>
        <p className="text-xs text-gray-500">{result.profile.communicationStyle}</p>
      </div>

      {/* 信号 */}
      <div className="bg-white rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">IOI / IOD 信号</h3>
          <span className={`text-sm font-bold ${result.signals.netScore >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            净评分 {result.signals.netScore >= 0 ? '+' : ''}{result.signals.netScore}
          </span>
        </div>
        <p className="text-xs text-gray-500">{result.signals.assessment}</p>
        {result.signals.ioi.length > 0 && (
          <div className="space-y-1">
            {result.signals.ioi.map((s, i) => (
              <p key={`ioi-${i}`} className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">+ {s.evidence}</p>
            ))}
          </div>
        )}
        {result.signals.iod.length > 0 && (
          <div className="space-y-1">
            {result.signals.iod.map((s, i) => (
              <p key={`iod-${i}`} className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2">− {s.evidence}</p>
            ))}
          </div>
        )}
        {result.signals.iodStreak >= 3 && (
          <p className="text-xs text-red-600 font-medium">已连续 {result.signals.iodStreak} 轮 IOD，触发冷冻规则</p>
        )}
      </div>

      {/* 对话还原 */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <button
          onClick={() => setShowDialog(v => !v)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <h3 className="font-semibold text-gray-800">对话还原（{result.dialog.turns.length} 条）</h3>
          {showDialog ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {showDialog && (
          <div className="px-4 pb-4 space-y-1.5 max-h-64 overflow-y-auto">
            {result.dialog.turns.map((t, i) => (
              <div key={i} className={`flex ${t.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                <span className={`text-xs px-3 py-1.5 rounded-xl max-w-[80%] ${
                  t.speaker === 'user'
                    ? 'bg-pink-100 text-pink-800'
                    : t.speaker === 'rival'
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-amber-50 text-amber-700'
                }`}>
                  {t.isMedia ? '[媒体] ' : ''}{t.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 九术依据 */}
      {result.tactics.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-lg space-y-2">
          <h3 className="font-semibold text-gray-800">九术依据</h3>
          {result.tactics.map((t, i) => (
            <div key={i} className="bg-purple-50/60 rounded-xl p-3">
              <p className="text-xs font-medium text-purple-700">{t.name}</p>
              <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{t.source}</p>
            </div>
          ))}
        </div>
      )}

      {/* 候选话术 */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-800 px-1">候选话术</h3>
        {result.suggestions.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-lg space-y-3">
            <p className="text-sm text-gray-800 leading-relaxed">{s.text}</p>
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">风险：{s.risk}</p>
            {s.tactics.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {s.tactics.map(t => (
                  <span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              {feedback[i] ? (
                <span className={`text-xs flex items-center gap-1 ${feedback[i] === 'adopted' ? 'text-emerald-600' : 'text-gray-400'}`}>
                  <Check className="w-3.5 h-3.5" />
                  {feedback[i] === 'adopted' ? '已采纳，祝顺利' : '已弃用，会用于优化'}
                </span>
              ) : (
                <>
                  <button
                    onClick={() => submitFeedback(i, 'adopted')}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" /> 采纳
                  </button>
                  <button
                    onClick={() => submitFeedback(i, 'rejected')}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-500"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" /> 弃用
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {result.metadata.mock && (
        <p className="text-center text-[10px] text-gray-300">开发模式：当前为模拟数据</p>
      )}
    </div>
  );
}

/* ---------------- 主页面 ---------------- */
interface HistoryItem {
  id: string;
  createdAt: string;
  rivalAlias: string;
  stage: string;
  strategyLabel: string;
}

export default function Analyze() {
  const { token, user, clearAuth } = useAuthStore();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await authFetch('/api/analyze');
      const json = await res.json();
      if (json.success) setHistory(json.data.slice(0, 10));
    } catch { /* 忽略 */ }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, token]);

  // 粘贴上传（手机截图后直接粘贴）
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.files || []).find(f => f.type.startsWith('image/'));
      if (item) {
        pickFile(item as File);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const pickFile = (f: File) => {
    if (!f.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }
    setError('');
    setResult(null);
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleAnalyze = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setProgress(0);
    setError('');
    try {
      const res = await uploadScreenshot(file, setProgress, token);
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || '分析失败');
      }
      setResult(json.data as AnalysisResult);
      loadHistory();
    } catch (e: any) {
      setError(e.message || '网络异常，请稍后重试');
    } finally {
      setUploading(false);
    }
  };

  const openHistory = async (id: string) => {
    try {
      const res = await authFetch(`/api/analyze/${id}`);
      const json = await res.json();
      if (json.success) {
        setResult(json.data as AnalysisResult);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch { /* 忽略 */ }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <div className="max-w-md mx-auto px-4 py-6 pb-28">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-5">
          <Link to="/" className="p-2 -ml-2 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-pink-500" />
            截图分析
          </h1>
          <div className="w-9" />
        </div>

        {/* 登录态 */}
        {token && user ? (
          <div className="flex items-center justify-between bg-white/70 rounded-xl px-4 py-2.5 mb-4">
            <span className="text-xs text-gray-600">{user.nickname} · {user.phone}</span>
            <button onClick={clearAuth} className="text-xs text-gray-400 flex items-center gap-1">
              <LogOut className="w-3.5 h-3.5" /> 退出
            </button>
          </div>
        ) : (
          <div className="mb-4"><LoginCard /></div>
        )}

        {/* 上传卡片 */}
        <div className="bg-white rounded-2xl p-5 shadow-lg mb-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) pickFile(f);
              e.target.value = '';
            }}
          />
          {preview ? (
            <div className="relative">
              <img src={preview} alt="截图预览" className="w-full max-h-72 object-contain rounded-xl bg-gray-50" />
              <button
                onClick={() => { setFile(null); setPreview(null); }}
                className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-pink-200 rounded-xl py-10 flex flex-col items-center gap-2 text-pink-400"
            >
              <ImagePlus className="w-10 h-10" />
              <span className="text-sm">点击选择聊天截图</span>
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <ClipboardPaste className="w-3 h-3" /> 也可以直接粘贴截图
              </span>
            </button>
          )}

          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

          {uploading && (
            <div className="mt-4">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-purple-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5 text-center">
                {progress < 100 ? `上传中 ${progress}%` : '分析中：识图 → 侧写 → 阶段 → 信号 → 决策 → 话术…'}
              </p>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!file || uploading}
            className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            开始分析
          </button>
        </div>

        {/* 结果 */}
        {result && <ResultView result={result} />}

        {/* 历史 */}
        {history.length > 0 && !result && (
          <div className="bg-white rounded-2xl p-5 shadow-lg">
            <h3 className="font-semibold text-gray-800 mb-3">历史分析</h3>
            <div className="space-y-2">
              {history.map(h => (
                <button
                  key={h.id}
                  onClick={() => openHistory(h.id)}
                  className="w-full flex items-center justify-between text-left bg-gray-50 rounded-xl px-3 py-2.5"
                >
                  <div>
                    <p className="text-xs text-gray-700">{h.rivalAlias} · {h.stage}</p>
                    <p className="text-[10px] text-gray-400">{new Date(h.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span className="text-xs text-purple-600">{h.strategyLabel}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
