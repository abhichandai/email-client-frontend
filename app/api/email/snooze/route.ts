import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function createSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (s: { name: string; value: string; options: Record<string, unknown> }[]) => s.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { emailId, until } = await req.json();
    if (!emailId) return NextResponse.json({ error: 'Missing emailId' }, { status: 400 });

    await supabase.from('emails')
      .update({ snoozed_until: until || null })
      .eq('id', emailId)
      .eq('user_id', user.id);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
