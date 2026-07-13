import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';

// Guest action: take an item out of the closet.
export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch {}
  const itemId = body?.itemId;
  const personName = (body?.personName || '').trim();
  const qty = Math.max(1, parseInt(body?.quantity, 10) || 1);

  if (!itemId) return NextResponse.json({ ok: false, error: 'Missing item.' }, { status: 400 });
  if (!personName) return NextResponse.json({ ok: false, error: 'Please enter your name.' }, { status: 400 });

  try {
    const sb = getServiceClient();
    const { data: item } = await sb.from('items').select('*').eq('id', itemId).single();
    if (!item) return NextResponse.json({ ok: false, error: 'Item not found.' }, { status: 404 });
    if (item.available_quantity < qty) {
      return NextResponse.json({ ok: false, error: `Only ${item.available_quantity} available.` }, { status: 400 });
    }
    await sb.from('items')
      .update({ available_quantity: item.available_quantity - qty, updated_at: new Date().toISOString() })
      .eq('id', itemId);
    await sb.from('transactions').insert({
      item_id: itemId,
      person_name: personName,
      quantity: qty,
      type: 'checkout',
      status: 'active',
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
