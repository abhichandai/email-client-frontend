import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function createSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (s) => s.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );
}

export async function GET() {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data } = await supabase.from('priority_rules').select('*').eq('user_id', user.id).single();
  return NextResponse.json(data || {});
}

export async function POST(request: NextRequest) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rules = await request.json();
  const { data, error } = await supabase.from('priority_rules').upsert({
    user_id: user.id,
    important_senders: rules.importantSenders || [],
    important_domains: rules.importantDomains || [],
    important_keywords: rules.importantKeywords || [],
    unimportant_senders: rules.unimportantSenders || [],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
