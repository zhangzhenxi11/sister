/**
 * /api/analyze —— 截图分析
 *
 * POST   /api/analyze              JSON body { image: base64 }（兼容旧端，移动端不推荐）
 * POST   /api/analyze/upload       multipart 文件上传（推荐：二进制 + 客户端压缩）
 * GET    /api/analyze              历史分析列表（摘要）
 * GET    /api/analyze/rules        当前生效的规则（可解释性）
 * GET    /api/analyze/:id          单次分析详情
 * DELETE /api/analyze/:id          删除分析
 * POST   /api/analyze/:id/feedback 用户反馈（回流规则调权）
 *
 * 认证：optionalAuth —— 携带 Bearer token 时结果归属该用户，未登录也可匿名使用。
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { analyzeScreenshots } from '../services/analysis/index.js';
import { listRules } from '../services/rules/engine.js';
import { optionalAuth } from '../middleware/auth.js';
import {
  addAnalysis,
  addFeedback,
  deleteAnalysis,
  getAnalyses,
  getAnalysisById,
  getFeedback,
} from '../data/store.js';
import type { AnalysisFeedback } from '../services/analysis/types.js';

const router = express.Router();

router.use(optionalAuth);

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 单文件 10MB（客户端压缩后通常 < 1MB）
const MAX_UPLOAD_COUNT = 9;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE, files: MAX_UPLOAD_COUNT },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件（image/*）'));
    }
  },
});

async function runAnalysis(images: string[], req: Request, res: Response): Promise<void> {
  try {
    const result = await analyzeScreenshots(images);
    result.userId = (req as any).user?.uid ?? undefined;
    addAnalysis(result);

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Analyze error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || '分析失败，请稍后重试',
    });
  }
}

/** 从请求中取图片数组：优先 multipart 多文件，其次 images 数组，兼容单个 image */
function extractImages(req: Request): string[] {
  if (Array.isArray(req.files) && req.files.length > 0) {
    return (req.files as Express.Multer.File[]).map(f => f.buffer.toString('base64'));
  }
  const { images, image } = req.body || {};
  if (Array.isArray(images) && images.length > 0) {
    return images.filter((i: unknown) => typeof i === 'string' && i.length > 0).slice(0, 9);
  }
  if (typeof image === 'string' && image) {
    return [image];
  }
  return [];
}

router.post('/', (req: Request, res: Response): void => {
  const images = extractImages(req);
  if (images.length === 0) {
    res.status(400).json({ success: false, error: '缺少截图：请提供 images 数组或 image（base64 / data URI）' });
    return;
  }
  void runAnalysis(images, req, res);
});

// multipart 包装：multer 错误（超限/类型不符）转为 400；支持多文件（字段名 file）
router.post('/upload', (req: Request, res: Response, next: NextFunction): void => {
  upload.array('file', MAX_UPLOAD_COUNT)(req, res, (err?: any) => {
    if (err) {
      res.status(400).json({ success: false, error: err?.message || '文件上传失败' });
      return;
    }
    next();
  });
}, (req: Request, res: Response): void => {
  const images = extractImages(req);
  if (images.length === 0) {
    res.status(400).json({ success: false, error: '缺少文件：请使用 multipart 字段名 "file" 上传至少一张截图' });
    return;
  }
  void runAnalysis(images, req, res);
});

/**
 * SSE 流式分析：逐步推送流水线进度（event: step），最终推送结果（event: done）。
 * 前端压缩后 base64 走 JSON 提交（EventSource 不支持 POST，用 fetch + ReadableStream 读取）。
 * 支持多张截图：{ images: [base64, ...] } 或兼容 { image: base64 }。
 */
router.post('/stream', (req: Request, res: Response): void => {
  const images = extractImages(req);
  if (images.length === 0) {
    res.status(400).json({ success: false, error: '缺少截图：请提供 images 数组或 image（base64 / data URI）' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event: string, data: unknown): void => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  send('step', { step: 0, name: `已接收 ${images.length} 张截图`, status: 'done' });

  void (async () => {
    try {
      const result = await analyzeScreenshots(images, (step, name, status) => {
        send('step', { step, name, status });
      });
      result.userId = (req as any).user?.uid ?? undefined;
      addAnalysis(result);
      send('done', result);
    } catch (error: any) {
      console.error('Analyze stream error:', error);
      send('error', { message: error?.message || '分析失败，请稍后重试' });
    } finally {
      res.end();
    }
  })();
});

router.get('/', (req: Request, res: Response): void => {
  const list = getAnalyses().map(a => ({
    id: a.id,
    createdAt: a.createdAt,
    rivalAlias: a.dialog.rivalAlias,
    stage: a.stage,
    netScore: a.signals.netScore,
    strategy: a.decision.strategy,
    strategyLabel: a.decision.strategyLabel,
    suggestionCount: a.suggestions.length,
    mock: a.metadata.mock,
  }));
  res.json({ success: true, data: list });
});

router.get('/rules', (req: Request, res: Response): void => {
  res.json({ success: true, data: listRules() });
});

/**
 * 反馈统计（规则健康度）：按命中的规则聚合采纳情况，支撑 rules.yaml 调权。
 * 注意：必须定义在 /:id 之前。
 */
router.get('/feedback/stats', (req: Request, res: Response): void => {
  const analyses = getAnalyses();
  const byId = new Map(analyses.map(a => [a.id, a]));
  const stats = new Map<string, { ruleId: string; adopted: number; edited: number; rejected: number }>();

  for (const fb of getFeedback()) {
    const analysis = byId.get(fb.analysisId);
    const ruleId = analysis?.decision.ruleId || 'unknown';
    if (!stats.has(ruleId)) {
      stats.set(ruleId, { ruleId, adopted: 0, edited: 0, rejected: 0 });
    }
    const s = stats.get(ruleId)!;
    if (fb.outcome === 'adopted') s.adopted++;
    else if (fb.outcome === 'edited') s.edited++;
    else s.rejected++;
  }

  const data = Array.from(stats.values())
    .map(s => ({
      ...s,
      total: s.adopted + s.edited + s.rejected,
      adoptRate: s.adopted + s.edited + s.rejected > 0
        ? Number(((s.adopted + s.edited * 0.5) / (s.adopted + s.edited + s.rejected)).toFixed(2))
        : 0,
    }))
    .sort((a, b) => b.total - a.total);

  res.json({ success: true, data });
});

router.get('/:id', (req: Request, res: Response): void => {
  const analysis = getAnalysisById(req.params.id);
  if (!analysis) {
    res.status(404).json({ success: false, error: '分析记录不存在' });
    return;
  }
  res.json({ success: true, data: analysis });
});

router.delete('/:id', (req: Request, res: Response): void => {
  if (!getAnalysisById(req.params.id)) {
    res.status(404).json({ success: false, error: '分析记录不存在' });
    return;
  }
  deleteAnalysis(req.params.id);
  res.json({ success: true });
});

router.post('/:id/feedback', (req: Request, res: Response): void => {
  const analysis = getAnalysisById(req.params.id);
  if (!analysis) {
    res.status(404).json({ success: false, error: '分析记录不存在' });
    return;
  }

  const { suggestionIndex, outcome, editedText, comment } = req.body || {};
  if (!Number.isInteger(suggestionIndex) || suggestionIndex < 0 || suggestionIndex >= analysis.suggestions.length) {
    res.status(400).json({ success: false, error: 'suggestionIndex 无效' });
    return;
  }
  if (!['adopted', 'edited', 'rejected'].includes(outcome)) {
    res.status(400).json({ success: false, error: "outcome 必须是 'adopted' | 'edited' | 'rejected'" });
    return;
  }

  const feedback: AnalysisFeedback = {
    analysisId: analysis.id,
    suggestionIndex,
    outcome,
    editedText: outcome === 'edited' ? String(editedText ?? '') : undefined,
    comment: comment ? String(comment) : undefined,
    createdAt: new Date(),
  };
  addFeedback(feedback);
  console.log(`[feedback] ${feedback.outcome} on analysis ${feedback.analysisId}#${feedback.suggestionIndex}`);

  res.json({ success: true, data: feedback });
});

export default router;
