import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function fetchGmailEmails(accessToken: string) {
  // List messages
  const listRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&labelIds=INBOX',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!listRes.ok) {
    const err = await listRes.text();
    throw new Error(`Gmail list error ${listRes.status}: ${err}`);
  }
  const listData = await listRes.json();
  const messages = listData.messages || [];

  // Fetch metadata for each message
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

  return emails.filter(Boolean);
}

async function prioritizeEmails(emails: object[]) {
  if (!emails.length) return [];
  if (!process.env.ANTHROPIC_API_KEY) {
    // No API key - return emails with default priority
    return emails.map((e: object) => ({ ...e, priority: 'MEDIUM', reason: 'AI unavailable' }));
  }

  const emailList = emails.map((e: { from?: string; subject?: string; snippet?: string }, i) =>
    `${i + 1}. From: ${e.from} | Subject: ${e.subject} | Preview: ${e.snippet?.substring(0, 100)}`
  ).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Classify each email as HIGH, MEDIUM, or LOW priority. Return ONLY a JSON array with objects {index, priority, reason}.

HIGH: Direct personal emails, client messages, urgent/action-required, financial or legal matters
MEDIUM: Team updates, follow-ups, newsletters from known contacts  
LOW: Marketing, bulk mail, automated notifications

Emails:
${emailList}

Return only valid JSON array, no other text.`
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
    const { accounts } = await request.json();
    if (!accounts?.length) return NextResponse.json({ emails: [] });

    let allEmails: object[] = [];

    for (const account of accounts) {
      if (account.provider === 'gmail' && account.tokens?.access_token) {
        try {
          const emails = await fetchGmailEmails(account.tokens.access_token);
          allEmails = allEmails.concat(emails.map((e: object) => ({ ...e, accountEmail: account.email })));
        } catch (e) {
          return NextResponse.json({ error: String(e), emails: [] }, { status: 500 });
        }
      }
    }

    allEmails.sort((a: { date?: string }, b: { date?: string }) => 
      new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
    );

    const prioritized = await prioritizeEmails(allEmails);
    return NextResponse.json({ emails: prioritized });
  } catch (e) {
    return NextResponse.json({ error: String(e), emails: [] }, { status: 500 });
  }
}
