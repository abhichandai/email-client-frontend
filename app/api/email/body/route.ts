import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getValidGmailToken } from '../../../../lib/gmail-token';

async function createSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (s) => s.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );
}

// Recursively extract plain text and HTML from Gmail payload parts
function extractBody(payload: Record<string, unknown>): { plain: string; html: string } {
  let plain = '';
  let html = '';

  const decodeBase64 = (data: string) => {
    try {
      return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    } catch { return ''; }
  };

  const mimeType = payload.mimeType as string || '';
  const body = payload.body as Record<string, unknown> | null;
  const parts = payload.parts as Record<string, unknown>[] | null;

  if (mimeType === 'text/plain' && body?.data) {
    plain = decodeBase64(body.data as string);
  } else if (mimeType === 'text/html' && body?.data) {
    html = decodeBase64(body.data as string);
  } else if (parts) {
    for (const part of parts) {
      const sub = extractBody(part as Record<string, unknown>);
      if (sub.plain) plain = plain || sub.plain;
      if (sub.html) html = html || sub.html;
    }
  }

  return { plain, html };
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { emailId } = await request.json();
  if (!emailId) return NextResponse.json({ error: 'Missing emailId' }, { status: 400 });

  // 1. Check if body is already cached in DB
  const { data: cached } = await supabase
    .from('emails')
    .select('body, body_html')
    .eq('id', emailId)
    .eq('user_id', user.id)
    .single();

  if (cached?.body) {
    return NextResponse.json({ body: cached.body, bodyHtml: cached.body_html || '' });
  }

  // 2. Get token server-side and fetch from Gmail
  let accessToken: string;
  try {
    accessToken = await getValidGmailToken(supabase, user.id);
  } catch {
    return NextResponse.json({ error: 'Gmail token unavailable' }, { status: 401 });
  }

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: `Gmail error ${res.status}` }, { status: 502 });
  }

  const msg = await res.json();
  const { plain, html } = extractBody(msg.payload || {});
  const body = plain || html || '';

  // 3. Cache in DB
  if (body) {
    await supabase
      .from('emails')
      .update({ body: plain || null, body_html: html || null })
      .eq('id', emailId)
      .eq('user_id', user.id);
  }

  return NextResponse.json({ body: plain || '', bodyHtml: html || '' });
}
