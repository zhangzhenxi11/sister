/**
 * /api/auth —— 手机号验证码鉴权
 *
 * POST /api/auth/sms/send  发送短信验证码 { phone }（mock 模式响应携带 devCode）
 * POST /api/auth/verify    校验验证码，签发 token { phone, code }；首登自动注册
 * GET  /api/auth/me        当前登录用户（requireAuth）
 * POST /api/auth/logout    前端弃用本地 token 即可（骨架无服务端会话）
 */
import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { sendCode, verifyCode } from '../services/auth/sms.js';
import { signToken } from '../services/auth/token.js';
import { requireAuth } from '../middleware/auth.js';
import { addUser, findUserByPhone, findUserById, touchUserLogin } from '../data/store.js';

const router = Router();

const PHONE_RE = /^1[3-9]\d{9}$/;

function sanitizeUser(user: { id: string; phone: string; nickname: string; createdAt: Date; lastLoginAt: Date }) {
  return {
    id: user.id,
    phone: user.phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2'),
    nickname: user.nickname,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

router.post('/sms/send', (req: Request, res: Response): void => {
  const { phone } = req.body || {};
  if (!PHONE_RE.test(String(phone || ''))) {
    res.status(400).json({ success: false, error: '手机号格式不正确' });
    return;
  }

  try {
    const result = sendCode(String(phone));
    res.json({
      success: true,
      data: {
        ttlSec: result.ttlSec,
        resent: result.resent,
        ...(result.devCode ? { devCode: result.devCode } : {}),
      },
    });
  } catch (error: any) {
    res.status(429).json({ success: false, error: error?.message || '发送失败' });
  }
});

router.post('/verify', (req: Request, res: Response): void => {
  const { phone, code } = req.body || {};
  if (!PHONE_RE.test(String(phone || ''))) {
    res.status(400).json({ success: false, error: '手机号格式不正确' });
    return;
  }
  if (!/^\d{6}$/.test(String(code || ''))) {
    res.status(400).json({ success: false, error: '验证码为 6 位数字' });
    return;
  }

  if (!verifyCode(String(phone), String(code))) {
    res.status(400).json({ success: false, error: '验证码错误或已过期' });
    return;
  }

  let user = findUserByPhone(String(phone));
  let isNewUser = false;
  if (!user) {
    isNewUser = true;
    user = {
      id: uuidv4(),
      phone: String(phone),
      nickname: `用户${String(phone).slice(-4)}`,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };
    addUser(user);
  } else {
    touchUserLogin(user.id);
  }

  const token = signToken(user.id, user.phone);
  console.log(`[auth] ${isNewUser ? '注册' : '登录'}: ${user.phone}`);

  res.json({
    success: true,
    data: {
      token,
      isNewUser,
      user: sanitizeUser(user),
    },
  });
});

router.get('/me', requireAuth, (req: Request, res: Response): void => {
  const user = findUserById(req.user!.uid);
  if (!user) {
    res.status(401).json({ success: false, error: '账号不存在' });
    return;
  }
  res.json({ success: true, data: sanitizeUser(user) });
});

router.post('/logout', (req: Request, res: Response): void => {
  // 无服务端会话：token 为自包含签名，前端删除即可；此处预留（如未来加 Redis 黑名单）
  res.json({ success: true });
});

export default router;
