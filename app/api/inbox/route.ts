import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function fetchGmailEmails(accessToken: string, pageToken?: string) {
  const params = new URLSearchParams({ maxResults: '50', labelIds: 'INBOX' });
  if (pageToken) params.set('pageToken', pageToken);

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!listRes.ok) {
    const err = await listRes.text();
    throw new Error(`Gmail list error ${listRes.status}: ${err}`);
  }
  const listData = await listRes.json();
  const messages = listData.messages || [];
  const nextPageToken = listData.nextPageToken || null;

  const emails = await Promise.all(
    messages.map(async (msg: { id: string; threadId: string }) => {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
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
        subject: get('Subject'),
        date: get('Date'),
        snippet: detail.snippet || '',
        isRead: !detail.labelIds?.includes('UNREAD'),
        threadId: detail.threadId,
      };
    })
  );

  return { emails: emails.filter(Boolean), nextPageToken };
}

async function prioritizeEmails(emails: object[], rules: {
  importantSenders?: string[];
  importantDomains?: string[];
  importantKeywords?: string[];
  unimportantSenders?: string[];
}) {
  if (!emails.length) return [];

  const rulesText = [
    rules.importantSenders?.length ? `Important senders: ${rules.importantSenders.join(', ')}` : '',
    rules.importantDomains?.length ? `Important domains: ${rules.importantDomains.join(', ')}` : '',
    rules.importantKeywords?.length ? `Important keywords: ${rules.importantKeywords.join(', ')}` : '',
    rules.unimportantSenders?.length ? `Unimportant senders: ${rules.unimportantSenders.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const emailList = emails.map((e: { from?: string; subject?: string; snippet?: string }, i) =>
    `${i + 1}. From: ${e.from} | Subject: ${e.subject} | Preview: ${e.snippet?.substring(0, 100)}`
  ).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are an email priority assistant. Classify each email as HIGH, MEDIUM, or LOW priority.

HIGH: Direct personal emails, client messages, urgent/action-required, financial, legal, anything time-sensitive
MEDIUM: Team updates, follow-ups, newsletters from known contacts, things worth reading
LOW: Marketing, bulk mail, automated notifications, social media digests, promotions

${rulesText ? `User's personal priority rules:\n${rulesText}\n` : ''}
Return ONLY a JSON array like: [{"index":1,"priority":"HIGH","reason":"Client email requiring response"}]

Emails to classify:
${emailList}`
    }]
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const clean = text.replace(/```json|```/g, '').trim();
    const priorities: { index: number; priority: string; reason: string }[] = JSON.parse(clean);
    return emails.map((e, i) => {
      const p = priorities.find(x => x.index === i + 1);
      return { ...e, priority: p?.priority || 'MEDIUM', reason: p?.reason || '' };
    });
  } catch {
    return emails.map(e => ({ ...e, priority: 'MEDIUM', reason: '' }));
  }
}

export async function POST(request: NextRequest) {
  try {
    const { accounts, pageToken, rules = {} } = await request.json();
    if (!accounts?.length) return NextResponse.json({ emails: [], nextPageToken: null });

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

    const prioritized = await prioritizeEmails(allEmails, rules);
    return NextResponse.json({ emails: prioritized, nextPageToken });
  } catch (e) {
    return NextResponse.json({ error: String(e), emails: [] }, { status: 500 });
  }
}
