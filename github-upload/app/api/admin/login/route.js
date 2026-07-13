import { NextResponse } from 'next/server';
import { createToken, AUTH_COOKIE, AUTH_MAX_AGE } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch {}
  const password = body?.password;
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return NextResponse.json({ ok: false, error: 'Server missing ADMIN_PASSWORD.' }, { status: 500 });
  }
  if (!password || password !== expected) {
    return NextResponse.json({ ok: false, error: 'Incorrect password.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, createToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: AUTH_MAX_AGE,
  });
  return res;
}
