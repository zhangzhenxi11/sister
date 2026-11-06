/**
 * 鉴权中间件
 *
 * optionalAuth：有合法 Bearer token 则挂载 req.user，无则匿名放行；
 * requireAuth： 无合法 token 返回 401。
 */
import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type TokenPayload } from '../services/auth/token.js';

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenPayload;
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ success: false, error: '未登录或登录已过期' });
    return;
  }
  req.user = payload;
  next();
}
