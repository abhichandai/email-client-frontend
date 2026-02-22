import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { getValidGmailToken } from '../../../lib/gmail-token';

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

// GET - check if user has been onboarded
export async function GET() {
  const supabase = await createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: settings } = await supabase
    .from('user_settings')
    .select('onboarded_at')
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({ onboarded: !!settings?.onboarded_at });
}

// POST - fetch emails, run AI, return categorised groups
export async function POST(req: NextRequest) {
  const supabase = await createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, emailUpdates } = await req.json();

  // Complete onboarding — save rules derived from user's category choices
  if (action === 'complete') {
    const importantSenders: string[] = [];
    const unimportantSenders: string[] = [];

    for (const { from, originalPriority, finalPriority } of (emailUpdates || [])) {
      if (!from) continue;
      const email = from.match(/<(.+)>/)?.[1] || from;
      // User actively promoted to HIGH → add as important sender
      if (finalPriority === 'HIGH' && originalPriority !== 'HIGH') {
        if (!importantSenders.includes(email)) importantSenders.push(email);
      }
      // User actively demoted to LOW → add as unimportant sender
      if (finalPriority === 'LOW' && originalPriority === 'HIGH') {
        if (!unimportantSenders.includes(email)) unimportantSenders.push(email);
      }
    }

    // Save rules if any were derived
    if (importantSenders.length || unimportantSenders.length) {
      const { data: existing } = await supabase
        .from('priority_rules').select('*').eq('user_id', user.id).single();
      await supabase.from('priority_rules').upsert({
        user_id: user.id,
        important_senders: [...(existing?.important_senders || []), ...importantSenders],
        important_domains: existing?.important_domains || [],
        important_keywords: existing?.important_keywords || [],
        unimportant_senders: [...(existing?.unimportant_senders || []), ...unimportantSenders],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }

    // Mark onboarded
    await supabase.from('user_settings').upsert({
      user_id: user.id,
      onboarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return NextResponse.json({ success: true });
  }

  // Fetch 100 emails from Gmail
  let accessToken: string;
  try {
    accessToken = await getValidGmailToken(supabase, user.id);
  } catch {
    return NextResponse.json({ error: 'Gmail token unavailable' }, { status: 401 });
  }

  const listRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&q=in:inbox',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!listRes.ok) return NextResponse.json({ error: 'Gmail fetch failed' }, { status: 502 });
  const listData = await listRes.json();
  const messageIds: string[] = (listData.messages || []).map((m: { id: string }) => m.id);

  // Batch fetch message details
  const emails: { id: string; from: string; subject: string; snippet: string; date: string; threadId: string }[] = [];
  await Promise.all(
    messageIds.map(async (id) => {
      try {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) return;
        const msg = await res.json();
        const headers = msg.payload?.headers || [];
        const get = (name: string) => headers.find((h: { name: string; value: string }) => h.name === name)?.value || '';
        emails.push({
          id: msg.id,
          from: get('From'),
          subject: get('Subject') || '(no subject)',
          snippet: msg.snippet || '',
          date: get('Date'),
          threadId: msg.threadId,
        });
      } catch { /* skip failed */ }
    })
  );

  // Sort by date descending
  emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Run Claude prioritization
  const emailList = emails.map((e, i) =>
    `${i + 1}. From: ${e.from} | Subject: ${e.subject} | Preview: ${e.snippet.substring(0, 120)}`
  ).join('\n');

  let prioritized: { index: number; priority: string; reason: string }[] = [];
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `You are helping a new user set up their AI email client. Classify each email into exactly one priority level.

HIGH: Direct personal messages to this specific person, client/customer emails, action required, financial (invoices, payments, contracts), legal matters, job-related, urgent requests from real people
MEDIUM: Team updates, project notifications, newsletters from known contacts, GitHub/Vercel/service alerts about the user's own projects, replies in ongoing conversations  
LOW: Automated system notifications, order confirmations, receipts, shipping updates
MARKETING: Newsletters, promotional emails, product marketing, sales outreach, event invitations from companies, social media notifications, mass campaigns, subscription digests

Key rule: If an email is addressed personally to the user (uses their name, references specific context, comes from a real person's email) it should be HIGH or MEDIUM even if the domain looks corporate. If it's clearly a mass send with no personal addressing, it's MARKETING or LOW.

Return ONLY a JSON array. No markdown. Example: [{"index":1,"priority":"HIGH","reason":"Client asking about project deadline"}]

Emails to classify:
${emailList}`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    prioritized = JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    // Fallback: everything MEDIUM
    prioritized = emails.map((_, i) => ({ index: i + 1, priority: 'MEDIUM', reason: '' }));
  }

  // Merge priorities back onto emails
  const result = emails.map((e, i) => {
    const p = prioritized.find(x => x.index === i + 1);
    return {
      ...e,
      priority: p?.priority || 'MEDIUM',
      reason: p?.reason || '',
    };
  });

  // Group into categories
  const grouped = {
    HIGH: result.filter(e => e.priority === 'HIGH'),
    MEDIUM: result.filter(e => e.priority === 'MEDIUM'),
    LOW: result.filter(e => e.priority === 'LOW' || e.priority === 'MARKETING'),
  };

  return NextResponse.json({ emails: result, grouped });
}
