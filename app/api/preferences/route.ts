import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

export async function GET() {
  const supabase = await createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('user_preferences')
    .select('signature')
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({ signature: data?.signature || '' });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { signature } = await req.json();

  await supabase.from('user_preferences').upsert(
    { user_id: user.id, signature: signature || '', updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );

  return NextResponse.json({ success: true });
}
