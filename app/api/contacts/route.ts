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

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const q = new URL(req.url).searchParams.get('q')?.toLowerCase().trim() || '';
    if (q.length < 1) return NextResponse.json({ contacts: [] });

    // Search contacts table (Google Contacts + inbox-mined)
    const { data: contacts } = await supabase
      .from('contacts')
      .select('email, name, photo_url, source, frequency')
      .eq('user_id', user.id)
      .or(`email.ilike.%${q}%,name.ilike.%${q}%`)
      .order('frequency', { ascending: false })
      .limit(8);

    // Also search from_address in emails table for anyone not in contacts
    const { data: inboxMatches } = await supabase
      .from('emails')
      .select('from_address')
      .eq('user_id', user.id)
      .ilike('from_address', `%${q}%`)
      .limit(20);

    // Parse and deduplicate inbox matches against contacts results
    const contactEmails = new Set((contacts || []).map((c: { email: string }) => c.email.toLowerCase()));
    const inboxContacts: { email: string; name: string | null; photo_url: null; source: string; frequency: number }[] = [];

    const seen = new Set<string>();
    for (const row of inboxMatches || []) {
      const raw: string = row.from_address || '';
      const match = raw.match(/^(.+?)\s*<(.+?)>$/);
      const email = (match ? match[2] : raw).toLowerCase().trim();
      const name = match ? match[1].replace(/^["']|["']$/g, '').trim() : null;

      if (!email || seen.has(email) || contactEmails.has(email)) continue;
      seen.add(email);
      inboxContacts.push({ email, name, photo_url: null, source: 'inbox', frequency: 0 });
    }

    const all = [...(contacts || []), ...inboxContacts].slice(0, 8);
    return NextResponse.json({ contacts: all });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
