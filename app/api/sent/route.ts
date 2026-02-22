import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getValidGmailToken } from '../../../lib/gmail-token';

async function createSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (s: { name: string; value: string; options: Record<string, unknown> }[]) => s.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );
}

const CACHE_MINUTES = 5;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const forceRefresh = body.forceRefresh === true;

    // --- Serve from cache if fresh ---
    if (!forceRefresh) {
      const cutoff = new Date(Date.now() - CACHE_MINUTES * 60 * 1000).toISOString();
      const { data: cached } = await supabase
        .from('emails')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_sent', true)
        .gte('fetched_at', cutoff)
        .order('date', { ascending: false })
        .limit(50);

      if (cached && cached.length > 0) {
        return NextResponse.json({ emails: cached.map(mapDbEmail), fromCache: true });
      }
    }

    // --- Fetch from Gmail ---
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
    if (messages.length === 0) return NextResponse.json({ emails: [] });

    const fetched_at = new Date().toISOString();

    const emails = (await Promise.all(messages.map(async (msg: { id: string; threadId: string }) => {
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
        user_id: user.id,
        provider: 'gmail',
        account_email: '',
        from_address: get('From'),
        subject: get('Subject'),
        date: get('Date'),
        snippet: detail.snippet || '',
        is_read: true,
        thread_id: detail.threadId,
        priority: 'MEDIUM',
        is_sent: true,
        is_complete: false,
        is_marketing: false,
        fetched_at,
      };
    }))).filter(Boolean);

    // Upsert to DB
    if (emails.length > 0) {
      await supabase.from('emails').upsert(emails, { onConflict: 'id,user_id' });
    }

    return NextResponse.json({ emails: emails.map(mapDbEmail), fromCache: false });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function mapDbEmail(e: Record<string, unknown>) {
  return {
    id: e.id,
    provider: e.provider,
    from: e.from_address,
    subject: e.subject,
    date: e.date,
    snippet: e.snippet,
    isRead: e.is_read,
    threadId: e.thread_id,
    priority: e.priority,
    priorityReason: e.priority_reason,
    priorityOverride: e.priority_override,
    isComplete: e.is_complete,
    isMarketing: e.is_marketing,
    isSent: true,
  };
}
