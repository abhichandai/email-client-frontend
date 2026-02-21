import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Map Supabase snake_case rows back to the camelCase shape the frontend expects
function mapDbEmail(row: Record<string, unknown>) {
  return {
    id: row.id,
    provider: row.provider,
    from: row.from_address,
    subject: row.subject,
    date: row.date,
    snippet: row.snippet,
    isRead: row.is_read,
    threadId: row.thread_id,
    accountEmail: row.account_email,
    priority: row.priority,
    reason: row.priority_reason,
    priority_override: row.priority_override,
  };
}

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

  const { emailId, priority, senderEmail, addToRules } = await request.json();

  if (addToRules && senderEmail) {
    // 1. Update priority_rules
    const { data: existing } = await supabase
      .from('priority_rules')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const rules = existing || { important_senders: [], unimportant_senders: [], important_domains: [], important_keywords: [] };

    if (priority === 'HIGH') {
      rules.important_senders = [...new Set([...(rules.important_senders || []), senderEmail])];
      rules.unimportant_senders = (rules.unimportant_senders || []).filter((s: string) => s !== senderEmail);
    } else if (priority === 'LOW') {
      rules.unimportant_senders = [...new Set([...(rules.unimportant_senders || []), senderEmail])];
      rules.important_senders = (rules.important_senders || []).filter((s: string) => s !== senderEmail);
    } else if (priority === 'MEDIUM') {
      // Remove from both lists — let AI decide (but set MEDIUM for now)
      rules.important_senders = (rules.important_senders || []).filter((s: string) => s !== senderEmail);
      rules.unimportant_senders = (rules.unimportant_senders || []).filter((s: string) => s !== senderEmail);
    }

    await supabase.from('priority_rules').upsert(
      { user_id: user.id, ...rules, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

    // 2. Bulk-update ALL emails from this sender in DB — no Gmail sync needed
    // Match on from_address containing the sender email
    await supabase
      .from('emails')
      .update({ priority, priority_override: priority })
      .eq('user_id', user.id)
      .ilike('from_address', `%${senderEmail}%`);

    // 3. Return all updated emails so the UI can refresh from DB
    const { data: updatedEmails } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    return NextResponse.json({ success: true, updatedEmails: (updatedEmails || []).map(mapDbEmail) });

  } else {
    // Single email override only
    await supabase
      .from('emails')
      .update({ priority, priority_override: priority })
      .eq('id', emailId)
      .eq('user_id', user.id);

    return NextResponse.json({ success: true, updatedEmails: null });
  }
}
