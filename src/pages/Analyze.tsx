import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ImagePlus, ClipboardPaste, X, LogOut, Loader2,
  Check, ThumbsUp, ThumbsDown, ScanLine,
} from 'lucide-react';
import { useAuthStore, authFetch } from '@/stores/authStore';
import { useAnalyzeStore } from '@/stores/analyzeStore';
import LoginCard from '@/components/LoginCard';
import type { AnalysisResult } from '../../api/services/analysis/types';

/* ---------------- 策略配色 ---------------- */
const STRATEGY_STYLES: Record<string, { badge: string; bg: string; label: string }> = {
  advance: { badge: 'bg-emerald-100 text-emerald-700', bg: 'from-emerald-50 to-teal-50 border-emerald-200', label: '进攻' },
  hold: { badge: 'bg-amber-100 text-amber-700', bg: 'from-amber-50 to-yellow-50 border-amber-200', label: '观察' },
  retreat_unload: { badge: 'bg-rose-100 text-rose-700', bg: 'from-rose-50 to-pink-50 border-rose-200', label: '退 · 卸防' },
  retreat_freeze: { badge: 'bg-red-100 text-red-700', bg: 'from-red-50 to-rose-50 border-red-200', label: '退 · 冷冻' },
};

const DEFENSE_LABELS: Record<string, string> = { low: '防御低', medium: '防御中', high: '防御高' };

/* ---------------- 结果视图 ---------------- */
function ResultView({ result }: { result: AnalysisResult }) {
  const [feedback, setFeedback] = useState<Record<number, 'adopted' | 'rejected'>>({});
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
      {/* 降级提示：LLM 不可用时的明确说明 */}
      {result.metadata.mock && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-800">
            大模型调用失败，当前为降级模式
          </p>
          <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
            下方「识别到的对话」是本地 OCR 真实识别结果；策略 / 侧写 / 话术为演示数据。
            请到「设置 → 大模型配置」检查 Key 与 Base URL 是否匹配。
          </p>
        </div>
      )}

      {/* 识别到的对话（真实 OCR 内容，置顶展示） */}
      <div className="bg-white rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">识别到的对话</h3>
          <div className="flex gap-1.5">
            <span className="text-[10px] bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full">
              {result.dialog.turns.length} 条
            </span>
            {result.dialog.sourceImageCount ? (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {result.dialog.sourceImageCount} 张截图
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="text-pink-500">{result.dialog.userAlias}</span>
          <span>×</span>
          <span>{result.dialog.rivalAlias}</span>
          {result.dialog.turns.some(t => t.speaker === 'unknown') && (
            <span className="text-[10px] text-amber-500">（部分说话人待判定）</span>
          )}
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
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
                {t.timeHint ? <span className="text-[9px] opacity-60 ml-1">{t.timeHint}</span> : null}
              </span>
            </div>
          ))}
        </div>
        {/* 原始 OCR 文本 */}
        {result.dialog.rawText && (
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-400 select-none">查看原始 OCR 文本</summary>
            <pre className="mt-2 p-3 bg-gray-50 rounded-xl text-[11px] text-gray-500 whitespace-pre-wrap max-h-48 overflow-y-auto">
              {result.dialog.rawText}
            </pre>
          </details>
        )}
      </div>

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

const MAX_IMAGES = 9;

export default function Analyze() {
  const { token, user, clearAuth } = useAuthStore();
  // 全局 store：切换路由不丢失进度，分析中离开页面结果也会写入
  const {
    files, previews, steps, uploading, result, error,
    addFiles, removeAt, runAnalysis, setResult,
  } = useAnalyzeStore();
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
      const items = Array.from(e.clipboardData?.files || []).filter(f => f.type.startsWith('image/'));
      if (items.length > 0) {
        addFiles(items as File[]);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFiles]);

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
            multiple
            className="hidden"
            onChange={e => {
              const list = Array.from(e.target.files || []);
              if (list.length > 0) addFiles(list);
              e.target.value = '';
            }}
          />
          {previews.length > 0 ? (
            <div>
              <div className="grid grid-cols-3 gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative">
                    <img
                      src={src}
                      alt={`截图 ${i + 1}`}
                      className="w-full h-24 object-cover rounded-xl bg-gray-50"
                    />
                    <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1.5 rounded">
                      {i + 1}/{files.length}
                    </span>
                    <button
                      onClick={() => removeAt(i)}
                      className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 rounded-full text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {files.length < MAX_IMAGES && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="h-24 rounded-xl border-2 border-dashed border-pink-200 flex flex-col items-center justify-center text-pink-300"
                  >
                    <ImagePlus className="w-6 h-6" />
                    <span className="text-[10px] mt-1">继续添加</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-2 text-center">
                已选 {files.length} 张（最多 {MAX_IMAGES} 张，建议按时间顺序选择）
              </p>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-pink-200 rounded-xl py-10 flex flex-col items-center gap-2 text-pink-400"
            >
              <ImagePlus className="w-10 h-10" />
              <span className="text-sm">点击选择聊天截图（可多选）</span>
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <ClipboardPaste className="w-3 h-3" /> 也可以直接粘贴截图
              </span>
            </button>
          )}

          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

          {(uploading || steps.length > 0) && (
            <div className="mt-4 bg-gray-50 rounded-xl p-3 space-y-2">
              {uploading && steps.length === 0 && (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-500 flex-shrink-0" />
                  <span className="text-xs text-gray-700">压缩上传中…</span>
                </div>
              )}
              {steps.map(s => (
                <div key={s.step} className="flex items-center gap-2">
                  {s.status === 'running' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-500 flex-shrink-0" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  )}
                  <span className={`text-xs ${s.status === 'done' ? 'text-gray-400' : 'text-gray-700'}`}>
                    {s.name}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => void runAnalysis()}
            disabled={files.length === 0 || uploading}
            className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            {uploading ? '分析中（可切换页面）' : '开始分析'}
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
