import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public read endpoint powering the dashboard.
export async function GET() {
  try {
    const sb = getServiceClient();
    const [cats, items, txs] = await Promise.all([
      sb.from('categories').select('*').order('name', { ascending: true }),
      sb.from('items').select('*').order('name', { ascending: true }),
      sb.from('transactions').select('*').order('created_at', { ascending: false }).limit(500),
    ]);
    return NextResponse.json({
      categories: cats.data || [],
      items: items.data || [],
      transactions: txs.data || [],
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
