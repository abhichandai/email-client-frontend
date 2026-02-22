import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
    const { emailId, accessToken } = await req.json();
    const supabase = await createSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Trash in Gmail
    if (accessToken) {
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/trash`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }

    // Remove from Supabase cache
    await supabase.from('emails').delete().eq('id', emailId).eq('user_id', user.id);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
