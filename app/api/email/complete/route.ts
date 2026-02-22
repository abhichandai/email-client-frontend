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

export async function POST(request: NextRequest) {
  const supabase = await createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { emailId, isComplete, threadId } = await request.json();

  if (threadId) {
    // Mark entire thread complete
    await supabase.from('emails').update({ is_complete: isComplete }).eq('user_id', user.id).eq('thread_id', threadId);
  } else {
    await supabase.from('emails').update({ is_complete: isComplete }).eq('id', emailId).eq('user_id', user.id);
  }

  return NextResponse.json({ success: true });
}
