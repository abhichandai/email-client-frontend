import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getValidGmailToken } from '../../../lib/gmail-token';

async function createSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (s) => s.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );
}

export async function POST() {
  try {
    const supabase = await createSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let accessToken: string;
    try {
      accessToken = await getValidGmailToken(supabase, user.id);
    } catch {
      return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });
    }

    const d = new Date();
    d.setDate(d.getDate() - 30);
    const query = `in:sent after:${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({ maxResults: '50', q: query })}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!listRes.ok) {
      if (listRes.status === 401) return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });
      return NextResponse.json({ error: 'Gmail error' }, { status: 500 });
    }

    const listData = await listRes.json();
    const messages = listData.messages || [];

    const emails = await Promise.all(messages.map(async (msg: { id: string; threadId: string }) => {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!detailRes.ok) return null;
      const detail = await detailRes.json();
      const headers = detail.payload?.headers || [];
      const get = (name: string) => headers.find((h: { name: string; value: string }) => h.name === name)?.value || '';
      return {
        id: msg.id,
        provider: 'gmail',
        from: get('From'),
        to: get('To'),
        subject: get('Subject'),
        date: get('Date'),
        snippet: detail.snippet || '',
        isRead: true,
        threadId: detail.threadId,
        priority: 'MEDIUM' as const,
        isSent: true,
      };
    }));

    return NextResponse.json({ emails: emails.filter(Boolean) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
