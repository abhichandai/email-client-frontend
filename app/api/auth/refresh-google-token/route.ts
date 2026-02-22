import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { refresh_token } = await req.json();
    if (!refresh_token) {
      return NextResponse.json({ error: 'No refresh token provided' }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Google credentials not configured' }, { status: 500 });
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.access_token) {
      return NextResponse.json({ error: data.error || 'Token refresh failed' }, { status: 401 });
    }

    return NextResponse.json({ access_token: data.access_token, expires_in: data.expires_in });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
