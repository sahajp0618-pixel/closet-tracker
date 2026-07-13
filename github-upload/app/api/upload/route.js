import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { isAdmin } from '@/lib/auth';

export const runtime = 'nodejs';

// ADMIN ONLY: upload an item photo to Supabase Storage, return its public URL.
export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: 'Admin only.' }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ ok: false, error: 'No file provided.' }, { status: 400 });
    }
    const ext = (file.name?.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `items/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || 'png'}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const sb = getServiceClient();
    const { error } = await sb.storage.from('item-images').upload(path, bytes, {
      contentType: file.type || 'image/png',
      upsert: false,
    });
    if (error) throw error;

    const { data } = sb.storage.from('item-images').getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
