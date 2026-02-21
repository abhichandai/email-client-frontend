import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function createSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
}

async function fetchGmailEmails(accessToken: string, pageToken?: string) {
  const params = new URLSearchParams({ maxResults: '50', labelIds: 'INBOX' });
  if (pageToken) params.set('pageToken', pageToken);
  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) throw new Error(`Gmail list error ${listRes.status}: ${await listRes.text()}`);
  const listData = await listRes.json();
  const messages = listData.messages || [];

  const emails = await Promise.all(messages.map(async (msg: { id: string; threadId: string }) => {
    const detailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!detailRes.ok) return null;
    const detail = await detailRes.json();
    const headers = detail.payload?.headers || [];
    const get = (name: string) => headers.find((h: { name: string; value: string }) => h.name === name)?.value || '';
    return {
      id: msg.id, provider: 'gmail', from: get('From'), subject: get('Subject'),
      date: get('Date'), snippet: detail.snippet || '',
      isRead: !detail.labelIds?.includes('UNREAD'), threadId: detail.threadId,
    };
  }));

  return { emails: emails.filter(Boolean), nextPageToken: listData.nextPageToken || null };
}

async function prioritizeEmails(emails: object[], rules: {
  importantSenders?: string[]; importantDomains?: string[];
  importantKeywords?: string[]; unimportantSenders?: string[];
}) {
  if (!emails.length) return [];
  const rulesText = [
    rules.importantSenders?.length ? `Important senders (mark HIGH): ${rules.importantSenders.join(', ')}` : '',
    rules.importantDomains?.length ? `Important domains (mark HIGH): ${rules.importantDomains.join(', ')}` : '',
    rules.importantKeywords?.length ? `Important keywords (mark HIGH): ${rules.importantKeywords.join(', ')}` : '',
    rules.unimportantSenders?.length ? `Unimportant senders (mark LOW): ${rules.unimportantSenders.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const emailList = emails.map((e: { from?: string; subject?: string; snippet?: string }, i) =>
    `${i + 1}. From: ${e.from} | Subject: ${e.subject} | Preview: ${e.snippet?.substring(0, 100)}`
  ).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5', max_tokens: 2048,
    messages: [{ role: 'user', content: `Classify each email as HIGH, MEDIUM, or LOW priority.
HIGH: Direct personal emails, client messages, urgent/action-required, financial, legal
MEDIUM: Team updates, follow-ups, newsletters from known contacts
LOW: Marketing, bulk mail, automated notifications, social media digests
${rulesText ? `\nUser rules:\n${rulesText}\n` : ''}
Return ONLY a JSON array: [{"index":1,"priority":"HIGH","reason":"..."}]

Emails:
${emailList}` }],
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const priorities: { index: number; priority: string; reason: string }[] = JSON.parse(text.replace(/```json|```/g, '').trim());
    return emails.map((e, i) => {
      const p = priorities.find(x => x.index === i + 1);
      return { ...e, priority: p?.priority || 'MEDIUM', reason: p?.reason || '' };
    });
  } catch {
    return emails.map(e => ({ ...e, priority: 'MEDIUM', reason: '' }));
  }
}

// GET - load from DB
export async function GET(request: NextRequest) {
  const supabase = await createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const priority = url.searchParams.get('priority');

  let query = supabase.from('emails').select('*').eq('user_id', user.id).order('date', { ascending: false }).range(offset, offset + limit - 1);
  if (priority) query = query.eq('priority', priority);

  const { data: emails, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Load rules
  const { data: rulesRow } = await supabase.from('priority_rules').select('*').eq('user_id', user.id).single();

  return NextResponse.json({ emails: emails || [], rules: rulesRow || null, fromCache: true });
}

// POST - sync from Gmail + save to DB
export async function POST(request: NextRequest) {
  const supabase = await createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { accounts, pageToken, rules = {}, forceRefresh = false } = await request.json();
  if (!accounts?.length) return NextResponse.json({ emails: [], nextPageToken: null });

  // If not forcing refresh and no pageToken, check if we have cached data < 5 mins old
  if (!forceRefresh && !pageToken) {
    const { data: cached } = await supabase.from('emails').select('fetched_at').eq('user_id', user.id).order('fetched_at', { ascending: false }).limit(1).single();
    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < 5 * 60 * 1000) {
        // Return from cache
        const { data: emails } = await supabase.from('emails').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(50);
        return NextResponse.json({ emails: emails || [], nextPageToken: null, fromCache: true });
      }
    }
  }

  // Fetch fresh from Gmail
  let allEmails: object[] = [];
  let nextPageToken = null;

  for (const account of accounts) {
    if (account.provider === 'gmail' && account.tokens?.access_token) {
      try {
        const result = await fetchGmailEmails(account.tokens.access_token, pageToken);
        allEmails = allEmails.concat(result.emails.map((e: object) => ({ ...e, accountEmail: account.email })));
        nextPageToken = result.nextPageToken;
      } catch (e) {
        return NextResponse.json({ error: String(e), emails: [] }, { status: 500 });
      }
    }
  }

  allEmails.sort((a: { date?: string }, b: { date?: string }) =>
    new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
  );

  // Load user rules from DB if not provided
  let activeRules = rules;
  if (!Object.values(rules).some((v: unknown) => Array.isArray(v) && v.length)) {
    const { data: dbRules } = await supabase.from('priority_rules').select('*').eq('user_id', user.id).single();
    if (dbRules) activeRules = {
      importantSenders: dbRules.important_senders || [],
      importantDomains: dbRules.important_domains || [],
      importantKeywords: dbRules.important_keywords || [],
      unimportantSenders: dbRules.unimportant_senders || [],
    };
  }

  const prioritized = await prioritizeEmails(allEmails, activeRules);

  // Save to DB (upsert)
  const toUpsert = prioritized.map((e: {
    id?: string; provider?: string; from?: string; accountEmail?: string;
    subject?: string; date?: string; snippet?: string; isRead?: boolean;
    threadId?: string; priority?: string; reason?: string;
  }) => ({
    id: e.id, user_id: user.id, provider: e.provider || 'gmail',
    account_email: e.accountEmail, from_address: e.from, subject: e.subject,
    date: e.date ? new Date(e.date).toISOString() : null,
    snippet: e.snippet, is_read: e.isRead, thread_id: e.threadId,
    priority: e.priority, priority_reason: e.reason, fetched_at: new Date().toISOString(),
  }));

  await supabase.from('emails').upsert(toUpsert, { onConflict: 'id,user_id', ignoreDuplicates: false });

  return NextResponse.json({ emails: prioritized, nextPageToken });
}
