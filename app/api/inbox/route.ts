import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getValidGmailToken, refreshGmailToken } from '../../../lib/gmail-token';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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
    snoozedUntil: row.snoozed_until || null,
  };
}

// Build Gmail search query for last 30 days
function buildGmailQuery() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  const yyyy = d.getFullYear();
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  return `in:inbox after:${yyyy}/${mm}/${dd}`;
}

async function fetchGmailEmails(accessToken: string, pageToken?: string) {
  const params = new URLSearchParams({ maxResults: '100', q: buildGmailQuery() });
  if (pageToken) params.set('pageToken', pageToken);
  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) {
    const body = await listRes.text();
    if (listRes.status === 401) throw new Error('AUTH_EXPIRED');
    throw new Error(`Gmail list error ${listRes.status}: ${body}`);
  }
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
    rules.importantKeywords?.length ? `Important keywords in subject (mark HIGH): ${rules.importantKeywords.join(', ')}` : '',
    rules.unimportantSenders?.length ? `Ignore senders (mark LOW): ${rules.unimportantSenders.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const emailList = emails.map((e: { from?: string; subject?: string; snippet?: string }, i) =>
    `${i + 1}. From: ${e.from} | Subject: ${e.subject} | Preview: ${e.snippet?.substring(0, 100)}`
  ).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5', max_tokens: 3000,
    messages: [{ role: 'user', content: `Classify each email into exactly one priority: HIGH, MEDIUM, LOW, or MARKETING.

HIGH: Direct personal messages, client/customer emails, action required, financial (invoices, payments, contracts), legal, job offers, urgent matters
MEDIUM: Team updates, project follow-ups, newsletters from known contacts, replies in ongoing conversations, GitHub/Vercel notifications about your projects
LOW: Automated system alerts, order confirmations, receipts, low-relevance notifications
MARKETING: Newsletters, promotional emails, product marketing, sales outreach, event invitations from companies, subscription digests, social media notifications (Instagram, Twitter, etc.), mass email campaigns

${rulesText ? `User rules (override the above):\n${rulesText}\n` : ''}
Return ONLY a JSON array. No explanation. No markdown. Example: [{"index":1,"priority":"HIGH","reason":"Direct client request"}]

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

// GET - load from DB (instant)
export async function GET(request: NextRequest) {
  const supabase = await createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '200');

  const now = new Date().toISOString();
  const { data: emails, error } = await supabase
    .from('emails').select('*').eq('user_id', user.id)
    .or(`snoozed_until.is.null,snoozed_until.lte.${now}`)
    .order('date', { ascending: false }).limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: rulesRow } = await supabase.from('priority_rules').select('*').eq('user_id', user.id).single();
  return NextResponse.json({ emails: (emails || []).map(mapDbEmail), rules: rulesRow || null, fromCache: true });
}

// POST - sync from Gmail
export async function POST(request: NextRequest) {
  const supabase = await createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { pageToken, rules = {}, forceRefresh = false } = await request.json();

  // Cache check (5 min) — skip on forceRefresh or pagination
  if (!forceRefresh && !pageToken) {
    const { data: cached } = await supabase.from('emails').select('fetched_at').eq('user_id', user.id).order('fetched_at', { ascending: false }).limit(1).single();
    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < 5 * 60 * 1000) {
        const cacheNow = new Date().toISOString();
        const { data: emails } = await supabase.from('emails').select('*').eq('user_id', user.id).or(`snoozed_until.is.null,snoozed_until.lte.${cacheNow}`).order('date', { ascending: false }).limit(200);
        return NextResponse.json({ emails: (emails || []).map(mapDbEmail), nextPageToken: null, fromCache: true });
      }
    }
  }

  // Get Gmail token server-side — no longer accepted from client
  let accessToken: string;
  try {
    accessToken = await getValidGmailToken(supabase, user.id);
  } catch (e) {
    const msg = String(e);
    if (msg.includes('NO_GMAIL_TOKEN') || msg.includes('NO_REFRESH_TOKEN')) {
      return NextResponse.json({ error: 'SESSION_EXPIRED', emails: [] }, { status: 401 });
    }
    return NextResponse.json({ error: msg, emails: [] }, { status: 500 });
  }

  // Get the user's account email for tagging
  const { data: { user: fullUser } } = await supabase.auth.getUser();
  const accountEmail = fullUser?.email || '';

  let allEmails: object[] = [];
  let nextPageToken = null;

  try {
    const result = await fetchGmailEmails(accessToken, pageToken);
    allEmails = result.emails.map((e: object) => ({ ...e, accountEmail }));
    nextPageToken = result.nextPageToken;
  } catch (e) {
    const msg = String(e);
    if (msg.includes('AUTH_EXPIRED')) {
      // Try one more refresh
      try {
        const newToken = await refreshGmailToken(supabase, user.id);
        const result = await fetchGmailEmails(newToken, pageToken);
        allEmails = result.emails.map((e: object) => ({ ...e, accountEmail }));
        nextPageToken = result.nextPageToken;
      } catch {
        return NextResponse.json({ error: 'SESSION_EXPIRED', emails: [] }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: msg, emails: [] }, { status: 500 });
    }
  }

  allEmails.sort((a: { date?: string }, b: { date?: string }) =>
    new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
  );

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

  // Fetch existing is_read states so we don't overwrite user's read/unread choices during sync
  const emailIds = (prioritized as { id?: string }[]).map((e) => e.id).filter(Boolean) as string[];
  const { data: existingEmails } = await supabase
    .from('emails').select('id, is_read').eq('user_id', user.id).in('id', emailIds);
  const existingReadState = new Map(
    (existingEmails || []).map((e: { id: string; is_read: boolean }) => [e.id, e.is_read])
  );

  const toUpsert = prioritized.map((e: {
    id?: string; provider?: string; from?: string; accountEmail?: string;
    subject?: string; date?: string; snippet?: string; isRead?: boolean;
    threadId?: string; priority?: string; reason?: string;
  }) => ({
    id: e.id, user_id: user.id, provider: e.provider || 'gmail',
    account_email: e.accountEmail, from_address: e.from, subject: e.subject,
    date: e.date ? new Date(e.date).toISOString() : null,
    snippet: e.snippet,
    // Preserve DB read state for existing emails — prevents sync from flipping emails back to unread
    is_read: existingReadState.has(e.id!) ? existingReadState.get(e.id!) : (e.isRead ?? false),
    thread_id: e.threadId,
    priority: e.priority === 'MARKETING' ? 'LOW' : (e.priority || 'MEDIUM'),
    priority_reason: e.reason,
    is_marketing: e.priority === 'MARKETING',
    fetched_at: new Date().toISOString(),
  }));

  await supabase.from('emails').upsert(toUpsert, { onConflict: 'id,user_id', ignoreDuplicates: false });

  // Map response to match the same shape as DB reads (isMarketing derived from priority)
  const responseEmails = prioritized.map((e: Record<string, unknown>) => ({
    ...e,
    isMarketing: e.priority === 'MARKETING',
    priority: e.priority === 'MARKETING' ? 'LOW' : (e.priority || 'MEDIUM'),
  }));

  return NextResponse.json({ emails: responseEmails, nextPageToken });
}
