/**
 * 轻量签名 token（HMAC-SHA256，零依赖）
 *
 * 格式：base64url(payloadJson).base64url(hmacSignature)
 * 骨架阶段够用；需要刷新令牌/撤销能力时迁移 jsonwebtoken + Redis。
 */
import crypto from 'crypto';

const SECRET = process.env.AUTH_SECRET || 'dev-insecure-secret-change-me';
const DEFAULT_TTL_SEC = Number(process.env.TOKEN_TTL_SECONDS) || 7 * 24 * 3600;

export interface TokenPayload {
  uid: string;
  phone: string;
  exp: number;
  [key: string]: unknown;
}

export function signToken(uid: string, phone: string, ttlSec: number = DEFAULT_TTL_SEC): string {
  const payload: TokenPayload = {
    uid,
    phone,
    exp: Date.now() + ttlSec * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as TokenPayload;
    if (!payload.exp || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
