/**
 * 分析页全局状态（内存级）
 *
 * 解决路由切换丢失进度的问题：files/previews/steps/result 挂在模块级 store，
 * 组件卸载不丢失；分析进行中切换页面，流式结果会继续写入 store，返回即见。
 */
import { create } from 'zustand';
import type { AnalysisResult } from '../../api/services/analysis/types';
import { analyzeWithStream, type StepEvent } from '@/lib/analyzeStream';

const MAX_IMAGES = 9;

interface AnalyzeState {
  files: File[];
  previews: string[];
  steps: StepEvent[];
  uploading: boolean;
  result: AnalysisResult | null;
  error: string;

  addFiles: (incoming: File[]) => void;
  removeAt: (index: number) => void;
  runAnalysis: () => Promise<void>;
  setResult: (r: AnalysisResult | null) => void;
}

export const useAnalyzeStore = create<AnalyzeState>()((set, get) => ({
  files: [],
  previews: [],
  steps: [],
  uploading: false,
  result: null,
  error: '',

  addFiles: (incoming) => {
    const valid = incoming.filter(f => f.type.startsWith('image/'));
    if (valid.length === 0) {
      set({ error: '请选择图片文件' });
      return;
    }
    const { files, previews } = get();
    const next = [...files, ...valid].slice(0, MAX_IMAGES);
    let error = '';
    if (files.length + valid.length > MAX_IMAGES) {
      error = `最多支持 ${MAX_IMAGES} 张，已截取前 ${MAX_IMAGES} 张`;
    }
    // 只为新加入的文件生成预览
    valid.forEach((f, vi) => {
      const idx = files.length + vi;
      if (idx < MAX_IMAGES && idx >= previews.length) {
        const reader = new FileReader();
        reader.onload = e => {
          set(s => {
            const copy = [...s.previews];
            copy[idx] = e.target?.result as string;
            return { previews: copy };
          });
        };
        reader.readAsDataURL(f);
      }
    });
    set({ files: next, error, result: null });
  },

  removeAt: (index) => {
    set(s => ({
      files: s.files.filter((_, i) => i !== index),
      previews: s.previews.filter((_, i) => i !== index),
    }));
  },

  runAnalysis: async () => {
    const { files, uploading } = get();
    if (files.length === 0 || uploading) return;
    set({ uploading: true, steps: [], error: '' });
    try {
      const data = await analyzeWithStream(files, e => {
        set(s => {
          const next = s.steps.filter(x => x.step !== e.step);
          next.push(e);
          return { steps: next.sort((a, b) => a.step - b.step) };
        });
      });
      // 分析完成后清除已上传文件（结果已包含对话内容），保留结果
      set({ result: data, files: [], previews: [] });
    } catch (e: any) {
      set({ error: e?.message || '网络异常，请稍后重试' });
    } finally {
      set({ uploading: false });
    }
  },

  setResult: (r) => set({ result: r }),
}));
