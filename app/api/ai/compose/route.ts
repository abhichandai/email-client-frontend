import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function createSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (s) => s.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { prompt, to, subject, replyContext } = await req.json();
    if (!prompt?.trim()) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });

    const isReply = !!replyContext;

    const systemPrompt = `You are an AI email assistant. Draft professional, concise emails based on the user's instruction.

Rules:
- Write in first person, natural professional tone
- Be concise — no fluff, no unnecessary filler phrases like "I hope this email finds you well"
- Match the register of the request (casual if casual, formal if formal)
- Never add a sign-off line (e.g. "Best regards") — the user will add their own
- Output ONLY valid JSON: { "subject": "...", "body": "..." }
- If a subject is already provided, keep it or improve it slightly. If blank, write a good one.
- Body should be plain text, use line breaks between paragraphs`;

    const userMessage = isReply
      ? `I'm replying to this email:

FROM: ${replyContext.from}
SUBJECT: ${replyContext.subject}
MESSAGE: ${replyContext.snippet || replyContext.body || '(no preview available)'}

My instruction: ${prompt}

To: ${to || replyContext.from}
Subject: ${subject || `Re: ${replyContext.subject}`}`
      : `Draft a new email.

To: ${to || '(recipient not set)'}
Subject: ${subject || '(no subject yet)'}
My instruction: ${prompt}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON from response, stripping any markdown fences
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({
      subject: parsed.subject || subject || '',
      body: parsed.body || '',
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
