import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { isAdmin } from '@/lib/auth';

export const runtime = 'nodejs';

// ADMIN ONLY: create a new item.
export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: 'Admin only.' }, { status: 401 });
  let body = {};
  try { body = await req.json(); } catch {}
  const name = (body?.name || '').trim();
  const categoryId = body?.categoryId || null;
  const qty = Math.max(0, parseInt(body?.totalQuantity, 10) || 0);
  const imageUrl = body?.imageUrl || null;

  if (!name) return NextResponse.json({ ok: false, error: 'Name is required.' }, { status: 400 });

  try {
    const sb = getServiceClient();
    const { data, error } = await sb.from('items').insert({
      name,
      category_id: categoryId,
      total_quantity: qty,
      available_quantity: qty,
      image_url: imageUrl,
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ ok: true, item: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
