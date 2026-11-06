/**
 * 短信验证码服务（骨架）
 *
 * - 验证码暂存内存 Map（TTL 5 分钟、60s 重发限制）；
 * - 服务商抽象：SMS_PROVIDER=mock（默认，验证码打进日志并在响应里返回 devCode，
 *   仅供开发联调）；真实服务商（阿里云/腾讯云）实现 sendViaProvider() 后切换。
 * - 骨架限制：单进程内存存储，多实例部署需换 Redis（接口不变）。
 */

const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_INTERVAL_MS = 60 * 1000;

interface SmsCodeRecord {
  code: string;
  expiresAt: number;
  lastSentAt: number;
}

const codeStore = new Map<string, SmsCodeRecord>();

export interface SendCodeResult {
  ttlSec: number;
  resent: boolean;
  /** 仅 mock 模式返回，方便联调；生产服务商下绝不返回 */
  devCode?: string;
}

export function sendCode(phone: string): SendCodeResult {
  const now = Date.now();
  const existing = codeStore.get(phone);
  if (existing && now - existing.lastSentAt < RESEND_INTERVAL_MS) {
    const wait = Math.ceil((RESEND_INTERVAL_MS - (now - existing.lastSentAt)) / 1000);
    throw new Error(`发送过于频繁，请 ${wait} 秒后再试`);
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  codeStore.set(phone, { code, expiresAt: now + CODE_TTL_MS, lastSentAt: now });

  const provider = process.env.SMS_PROVIDER || 'mock';
  if (provider === 'mock') {
    console.log(`[sms-mock] 验证码 ${phone} -> ${code}（5 分钟内有效）`);
    return { ttlSec: CODE_TTL_MS / 1000, resent: Boolean(existing), devCode: code };
  }

  // TODO: 接入真实短信服务商（阿里云 dysms / 腾讯云 sms）
  console.warn(`[sms] provider "${provider}" 尚未实现，验证码未实际下发`);
  return { ttlSec: CODE_TTL_MS / 1000, resent: Boolean(existing) };
}

export function verifyCode(phone: string, code: string): boolean {
  const record = codeStore.get(phone);
  if (!record) return false;
  if (record.expiresAt < Date.now()) {
    codeStore.delete(phone);
    return false;
  }
  const ok = record.code === String(code).trim();
  if (ok) {
    codeStore.delete(phone); // 一次性
  }
  return ok;
}
