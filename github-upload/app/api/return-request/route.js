import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';

// Guest action: request to return something they took.
// This does NOT restock the item — it waits for admin confirmation.
export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch {}
  const transactionId = body?.transactionId;
  if (!transactionId) return NextResponse.json({ ok: false, error: 'Missing transaction.' }, { status: 400 });

  try {
    const sb = getServiceClient();
    const { data: tx } = await sb.from('transactions').select('*').eq('id', transactionId).single();
    if (!tx) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
    if (tx.status !== 'active') {
      return NextResponse.json({ ok: false, error: 'This item is not currently out.' }, { status: 400 });
    }
    await sb.from('transactions').update({ status: 'return_pending' }).eq('id', transactionId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
