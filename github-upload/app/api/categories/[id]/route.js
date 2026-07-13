import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { isAdmin } from '@/lib/auth';

export const runtime = 'nodejs';

// ADMIN ONLY: rename / recolor a category.
export async function PATCH(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: 'Admin only.' }, { status: 401 });
  let body = {};
  try { body = await req.json(); } catch {}
  const patch = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.color !== undefined) patch.color = body.color;
  if (body.icon !== undefined) patch.icon = body.icon;

  try {
    const sb = getServiceClient();
    await sb.from('categories').update(patch).eq('id', params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// ADMIN ONLY: delete a category (items keep existing, just uncategorized).
export async function DELETE(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: 'Admin only.' }, { status: 401 });
  try {
    const sb = getServiceClient();
    await sb.from('categories').delete().eq('id', params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
