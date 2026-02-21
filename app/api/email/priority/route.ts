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

export async function POST(request: NextRequest) {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { emailId, priority, senderEmail, addToRules } = await request.json();

  // Update the email's priority
  await supabase.from('emails').update({ priority, priority_override: priority }).eq('id', emailId).eq('user_id', user.id);

  // Optionally add sender to rules
  if (addToRules && senderEmail) {
    const { data: existing } = await supabase.from('priority_rules').select('*').eq('user_id', user.id).single();
    const rules = existing || { important_senders: [], unimportant_senders: [], important_domains: [], important_keywords: [] };
    
    if (priority === 'HIGH') {
      rules.important_senders = [...new Set([...(rules.important_senders || []), senderEmail])];
      rules.unimportant_senders = (rules.unimportant_senders || []).filter((s: string) => s !== senderEmail);
    } else if (priority === 'LOW') {
      rules.unimportant_senders = [...new Set([...(rules.unimportant_senders || []), senderEmail])];
      rules.important_senders = (rules.important_senders || []).filter((s: string) => s !== senderEmail);
    }

    await supabase.from('priority_rules').upsert({ user_id: user.id, ...rules, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  }

  return NextResponse.json({ success: true });
}
