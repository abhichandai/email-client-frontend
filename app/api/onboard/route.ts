import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { getValidGmailToken } from '../../../lib/gmail-token';

// Allow up to 60s — onboarding fetches + Claude classification takes ~15-20s
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function createSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (s: { name: string; value: string; options: Record<string, unknown> }[]) =>
          s.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
}

async function fetchEmailsForOnboarding(accessToken: string) {
  const params = new URLSearchParams({ maxResults: '50', q: 'in:inbox -in:trash -in:spam' });
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!listRes.ok) throw new Error(`Gmail error ${listRes.status}`);
  const listData = await listRes.json();
  const messages: { id: string; threadId: string }[] = listData.messages || [];

  const batchSize = 20;
  const emails = [];
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (msg) => {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) return null;
        const detail = await res.json();
        const headers = detail.payload?.headers || [];
        const get = (name: string) =>
          headers.find((h: { name: string; value: string }) => h.name === name)?.value || '';
        return {
          id: msg.id, from: get('From'), subject: get('Subject'),
          date: get('Date'), snippet: detail.snippet || '',
          isRead: !detail.labelIds?.includes('UNREAD'), threadId: detail.threadId,
        };
      })
    );
    emails.push(...results.filter(Boolean));
  }
  return emails;
}

async function classifyEmails(emails: { from?: string; subject?: string; snippet?: string }[]) {
  if (!emails.length) return [];
  const emailList = emails
    .map((e, i) => `${i + 1}. From: ${e.from} | Subject: ${e.subject} | Preview: ${e.snippet?.substring(0, 120)}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are helping a user set up their AI email client for the first time. Classify each email.

PRIORITY (HIGH): Direct personal messages by name, client/customer emails, action required, financial (invoices, payments, contracts), legal, job offers, time-sensitive matters
IMPORTANT (MEDIUM): Team updates, ongoing project conversations, newsletters from real people, GitHub/service notifications for their own projects
LOW: Automated alerts, order confirmations, receipts, account notifications
MARKETING: Newsletters, promotional emails, product marketing, sales outreach, social media digests, mass company emails

Key signal: If the email addresses this person directly and personally, lean HIGH. If it's a mass send, lean MARKETING.

Return ONLY a JSON array. No explanation. No markdown.
Format: [{"index":1,"priority":"HIGH","reason":"Client asking about deliverable"}]

Emails:
${emailList}`,
    }],
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    const priorities: { index: number; priority: string; reason: string }[] = JSON.parse(
      text.replace(/```json|```/g, '').trim()
    );
    return emails.map((e, i) => {
      const p = priorities.find((x) => x.index === i + 1);
      return { ...e, priority: p?.priority || 'MEDIUM', reason: p?.reason || '' };
    });
  } catch {
    return emails.map((e) => ({ ...e, priority: 'MEDIUM', reason: '' }));
  }
}

export async function GET() {
  try {
    const supabase = await createSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const accessToken = await getValidGmailToken(supabase, user.id);
    const emails = await fetchEmailsForOnboarding(accessToken);
    const classified = await classifyEmails(emails.filter((e): e is NonNullable<typeof e> => e !== null));
    return NextResponse.json({ emails: classified });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { emails } = await req.json();

    const toUpsert = emails.map((e: {
      id: string; from: string; subject: string; date: string;
      snippet: string; isRead: boolean; threadId: string; priority: string; reason: string;
    }) => ({
      id: e.id, user_id: user.id, provider: 'gmail',
      from_address: e.from, subject: e.subject,
      date: e.date ? new Date(e.date).toISOString() : null,
      snippet: e.snippet, is_read: e.isRead, thread_id: e.threadId,
      priority: e.priority === 'MARKETING' ? 'LOW' : (e.priority || 'MEDIUM'),
      priority_reason: e.reason,
      is_marketing: e.priority === 'MARKETING',
      fetched_at: new Date().toISOString(),
    }));

    if (toUpsert.length > 0) {
      await supabase.from('emails').upsert(toUpsert, { onConflict: 'id,user_id', ignoreDuplicates: false });
    }

    // Seed initial priority rules from HIGH emails
    const highEmails = emails.filter((e: { priority: string }) => e.priority === 'HIGH');
    const importantSenders: string[] = [];
    const importantDomains: string[] = [];
    const publicDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];

    for (const e of highEmails) {
      const raw: string = e.from || '';
      const emailMatch = raw.match(/<(.+?)>/) || raw.match(/[\w.-]+@[\w.-]+/);
      const emailAddr = emailMatch ? (emailMatch[1] || emailMatch[0]) : null;
      if (emailAddr) {
        importantSenders.push(emailAddr.toLowerCase());
        const domain = emailAddr.split('@')[1];
        if (domain && !publicDomains.includes(domain)) importantDomains.push(domain.toLowerCase());
      }
    }

    const uniqueSenders = [...new Set(importantSenders)].slice(0, 20);
    const uniqueDomains = [...new Set(importantDomains)].slice(0, 10);

    if (uniqueSenders.length > 0 || uniqueDomains.length > 0) {
      await supabase.from('priority_rules').upsert(
        { user_id: user.id, important_senders: uniqueSenders, important_domains: uniqueDomains,
          important_keywords: [], unimportant_senders: [], updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    }

    await supabase.from('user_preferences').upsert(
      { user_id: user.id, onboarded_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
