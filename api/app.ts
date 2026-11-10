/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import learnRoutes from './routes/learn.js'
import personaRoutes from './routes/persona.js'
import chatRoutes from './routes/chat.js'
import analyzeRoutes from './routes/analyze.js'
import { withLlmOverride } from './services/llmContext.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({
  limit: '25mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use((req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

/**
 * 请求级 LLM 配置覆盖：x-llm-key / x-llm-base-url / x-llm-model
 * 设置页配置的自定义大模型凭据在此注入本请求链路。
 */
app.use((req: Request, _res: Response, next: NextFunction): void => {
  const override: { apiKey?: string; baseURL?: string; model?: string } = {};
  const key = req.headers['x-llm-key'];
  const baseURL = req.headers['x-llm-base-url'];
  const model = req.headers['x-llm-model'];
  if (typeof key === 'string' && key.trim()) override.apiKey = key.trim();
  if (typeof baseURL === 'string' && baseURL.trim()) override.baseURL = baseURL.trim();
  if (typeof model === 'string' && model.trim()) override.model = model.trim();

  if (Object.keys(override).length === 0) {
    next();
    return;
  }
  withLlmOverride(override, () => next());
});

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/auth', authRoutes)
app.use('/api/learn', learnRoutes)
app.use('/api/learn', personaRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/analyze', analyzeRoutes)

/**
 * 生产模式：Express 直接托管前端构建产物（单容器部署形态）。
 * SPA 路由回退到 index.html；/api 与 /uploads 已在上方注册，不受影响。
 */
const distDir = path.join(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/(api|uploads)\/).*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
