import { NextRequest, NextResponse } from 'next/server';
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

function mapDbEmail(row: Record<string, unknown>) {
  return {
    id: row.id, provider: row.provider || 'gmail',
    from: row.from_address, subject: row.subject, date: row.date,
    snippet: row.snippet, isRead: row.is_read, threadId: row.thread_id,
    accountEmail: row.account_email, priority: row.priority || 'MEDIUM',
    priorityReason: row.priority_reason, priority_override: row.priority_override,
    body: row.body, bodyHtml: row.body_html,
    isComplete: row.is_complete || false,
    isMarketing: row.is_marketing || false,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ emails: [] });
    }

    const q = query.trim();
    const supabase = await createSupabase();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // --- Supabase search (cached emails) ---
    const { data: dbResults } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', user.id)
      .or(`from_address.ilike.%${q}%,subject.ilike.%${q}%,snippet.ilike.%${q}%`)
      .order('date', { ascending: false })
      .limit(50);

    const cachedEmails = (dbResults || []).map(mapDbEmail);

    // --- Gmail search fallback for results not in cache ---
    let gmailEmails: Record<string, unknown>[] = [];
    try {
      const accessToken = await getValidGmailToken(supabase, user.id);
      const gmailQuery = encodeURIComponent(q);
      const gmailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${gmailQuery}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (gmailRes.ok) {
        const gmailData = await gmailRes.json();
        const messages: { id: string; threadId: string }[] = gmailData.messages || [];

        // Only fetch details for IDs not already in DB results
        const cachedIds = new Set(cachedEmails.map(e => e.id));
        const newMessages = messages.filter(m => !cachedIds.has(m.id));

        if (newMessages.length > 0) {
          const details = await Promise.all(
            newMessages.slice(0, 10).map(async (msg) => {
              const res = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              if (!res.ok) return null;
              const detail = await res.json();
              const headers = detail.payload?.headers || [];
              const get = (name: string) => headers.find((h: { name: string; value: string }) => h.name === name)?.value || '';
              return {
                id: msg.id, provider: 'gmail' as const,
                from: get('From'), subject: get('Subject'), date: get('Date'),
                snippet: detail.snippet || '', isRead: !detail.labelIds?.includes('UNREAD'),
                threadId: detail.threadId, accountEmail: '',
                priority: 'MEDIUM' as const, isComplete: false, isMarketing: false,
              };
            })
          );
          gmailEmails = details.filter((d): d is NonNullable<typeof d> => d !== null);
        }
      }
    } catch (_e) {
      // Gmail search is best-effort — cached results still returned
    }

    const allResults = [...cachedEmails, ...gmailEmails];
    // Deduplicate by id
    const seen = new Set<string>();
    const deduped = allResults.filter(e => {
      const id = e.id as string;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    return NextResponse.json({ emails: deduped, total: deduped.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
