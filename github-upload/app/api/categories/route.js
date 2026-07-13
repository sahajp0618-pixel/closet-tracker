import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { isAdmin } from '@/lib/auth';

export const runtime = 'nodejs';

// ADMIN ONLY: create a category.
export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: 'Admin only.' }, { status: 401 });
  let body = {};
  try { body = await req.json(); } catch {}
  const name = (body?.name || '').trim();
  const color = body?.color || '#F59E0B';
  const icon = body?.icon || 'sparkles';
  if (!name) return NextResponse.json({ ok: false, error: 'Name is required.' }, { status: 400 });

  try {
    const sb = getServiceClient();
    const { data, error } = await sb.from('categories')
      .insert({ name, color, icon }).select().single();
    if (error) throw error;
    return NextResponse.json({ ok: true, category: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
