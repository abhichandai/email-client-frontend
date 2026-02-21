import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'https://email-client-backend.vercel.app';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const res = await fetch(`${BACKEND}/emails/inbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    
    // Log for debugging
    console.log('Backend status:', res.status);
    console.log('Backend response:', text.substring(0, 500));

    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: res.status });
    } catch {
      // Backend returned non-JSON - return it as an error
      return NextResponse.json({ 
        error: `Backend error (${res.status}): ${text.substring(0, 200)}`,
        emails: [] 
      }, { status: 500 });
    }
  } catch (e) {
    console.error('Proxy error:', e);
    return NextResponse.json({ error: String(e), emails: [] }, { status: 500 });
  }
}
