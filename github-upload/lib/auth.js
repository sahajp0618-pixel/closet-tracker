import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'closet_admin';
const MAX_AGE_SEC = 60 * 60 * 12; // 12 hours

function secret() {
  return process.env.ADMIN_SESSION_SECRET || 'dev-insecure-secret-change-me';
}

// Create a signed session token: base64(payload).hmacSignature
export function createToken() {
  const payload = { role: 'admin', exp: Date.now() + MAX_AGE_SEC * 1000 };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [data, sig] = token.split('.');
  if (!data || !sig) return false;
  const expected = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  // constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!payload || payload.role !== 'admin') return false;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

// Read the request cookies and tell whether the caller is an admin.
export function isAdmin() {
  const token = cookies().get(COOKIE_NAME)?.value;
  return verifyToken(token);
}

export const AUTH_COOKIE = COOKIE_NAME;
export const AUTH_MAX_AGE = MAX_AGE_SEC;
