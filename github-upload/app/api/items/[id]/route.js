import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { isAdmin } from '@/lib/auth';

export const runtime = 'nodejs';

// ADMIN ONLY: edit an item.
export async function PATCH(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: 'Admin only.' }, { status: 401 });
  const id = params.id;
  let body = {};
  try { body = await req.json(); } catch {}

  try {
    const sb = getServiceClient();
    const { data: item } = await sb.from('items').select('*').eq('id', id).single();
    if (!item) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });

    const patch = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) patch.name = String(body.name).trim();
    if (body.categoryId !== undefined) patch.category_id = body.categoryId || null;
    if (body.imageUrl !== undefined) patch.image_url = body.imageUrl || null;

    // Changing total quantity shifts availability by the same delta,
    // so items currently checked out stay accounted for.
    if (body.totalQuantity !== undefined) {
      const newTotal = Math.max(0, parseInt(body.totalQuantity, 10) || 0);
      const delta = newTotal - item.total_quantity;
      patch.total_quantity = newTotal;
      patch.available_quantity = Math.max(0, item.available_quantity + delta);
    }

    await sb.from('items').update(patch).eq('id', id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// ADMIN ONLY: delete an item.
export async function DELETE(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: 'Admin only.' }, { status: 401 });
  try {
    const sb = getServiceClient();
    await sb.from('items').delete().eq('id', params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
