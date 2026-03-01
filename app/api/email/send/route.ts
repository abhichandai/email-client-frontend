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

interface Attachment {
  name: string;
  type: string;
  data: string; // base64
}

function makeRfc2822(to: string, from: string, subject: string, body: string, inReplyTo?: string, attachments?: Attachment[]) {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  if (!attachments || attachments.length === 0) {
    // Simple plain text email
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

  // Multipart email with attachments
  const lines = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`);
  lines.push('');

  // Text body part
  lines.push(`--${boundary}`);
  lines.push(`Content-Type: text/plain; charset=utf-8`);
  lines.push(`Content-Transfer-Encoding: quoted-printable`);
  lines.push('');
  lines.push(body);
  lines.push('');

  // Attachment parts
  for (const att of attachments) {
    const safeName = att.name.replace(/[^\w.\-]/g, '_');
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: ${att.type || 'application/octet-stream'}; name="${safeName}"`);
    lines.push(`Content-Transfer-Encoding: base64`);
    lines.push(`Content-Disposition: attachment; filename="${safeName}"`);
    lines.push('');
    // Wrap base64 at 76 chars per RFC 2045
    const b64 = att.data.replace(/(.{76})/g, '$1\r\n');
    lines.push(b64);
    lines.push('');
  }

  lines.push(`--${boundary}--`);
  return lines.join('\r\n');
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { to, subject, body, fromEmail, threadId, inReplyTo, attachments } = await request.json();
  if (!to || !body) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  // Get token server-side
  let accessToken: string;
  try {
    accessToken = await getValidGmailToken(supabase, user.id);
  } catch {
    return NextResponse.json({ error: 'Gmail token unavailable' }, { status: 401 });
  }

  const raw = makeRfc2822(to, fromEmail || '', subject || '', body, inReplyTo, attachments);
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
