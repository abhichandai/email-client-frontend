import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { subject, from, snippet, body } = await req.json();
    if (!subject && !snippet) return NextResponse.json({ suggestions: [] });

    const emailContent = `From: ${from}\nSubject: ${subject}\n\n${body || snippet}`;

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Generate exactly 3 short, natural reply options for this email. Each should be a complete, ready-to-send reply of 1-2 sentences max. Return ONLY a JSON array of 3 strings, no other text.

Email:
${emailContent.slice(0, 1500)}

Return format: ["reply 1", "reply 2", "reply 3"]`,
      }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]';
    const match = text.match(/\[[\s\S]*\]/);
    const suggestions = match ? JSON.parse(match[0]) : [];

    return NextResponse.json({ suggestions: suggestions.slice(0, 3) });
  } catch (e) {
    console.error('Reply suggestions error:', e);
    return NextResponse.json({ suggestions: [] });
  }
}
