import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { isAdmin } from '@/lib/auth';

export const runtime = 'nodejs';

// ADMIN ONLY: approve (restock) or reject a return request.
export async function POST(req) {
  if (!isAdmin()) {
    return NextResponse.json({ ok: false, error: 'Admin only.' }, { status: 401 });
  }
  let body = {};
  try { body = await req.json(); } catch {}
  const transactionId = body?.transactionId;
  const action = body?.action === 'reject' ? 'reject' : 'approve';
  if (!transactionId) return NextResponse.json({ ok: false, error: 'Missing transaction.' }, { status: 400 });

  try {
    const sb = getServiceClient();
    const { data: tx } = await sb.from('transactions').select('*').eq('id', transactionId).single();
    if (!tx) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
    if (tx.status === 'returned') {
      return NextResponse.json({ ok: false, error: 'Already returned.' }, { status: 400 });
    }

    if (action === 'reject') {
      // Send it back to "out" — guest still has the item.
      await sb.from('transactions').update({ status: 'active' }).eq('id', transactionId);
      return NextResponse.json({ ok: true, action: 'reject' });
    }

    // Approve: restock the item and close the transaction.
    const { data: item } = await sb.from('items').select('*').eq('id', tx.item_id).single();
    if (item) {
      await sb.from('items')
        .update({ available_quantity: item.available_quantity + tx.quantity, updated_at: new Date().toISOString() })
        .eq('id', tx.item_id);
    }
    await sb.from('transactions')
      .update({ status: 'returned', type: 'return', resolved_at: new Date().toISOString() })
      .eq('id', transactionId);
    return NextResponse.json({ ok: true, action: 'approve' });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
