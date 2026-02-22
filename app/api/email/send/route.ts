import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function createSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (s) => s.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );
}

function makeRfc2822(to: string, from: string, subject: string, body: string, threadId?: string, inReplyTo?: string) {
  const lines = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    `MIME-Version: 1.0`,
  ];
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`);
  lines.push('', body);
  return lines.join('\r\n');
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { to, subject, body, accessToken, fromEmail, threadId, inReplyTo } = await request.json();
  if (!to || !body || !accessToken) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  const raw = makeRfc2822(to, fromEmail || '', subject || '', body, threadId, inReplyTo);
  const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const payload: Record<string, unknown> = { raw: encoded };
  if (threadId) payload.threadId = threadId;

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `Gmail send error: ${err}` }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
