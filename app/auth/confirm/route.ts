import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

async function syncGoogleContacts(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  accessToken: string
) {
  const contacts: { user_id: string; email: string; name: string | null; photo_url: string | null; source: string }[] = [];
  let pageToken: string | undefined;

  // Paginate through all connections
  do {
    const params = new URLSearchParams({
      personFields: 'names,emailAddresses,photos',
      pageSize: '1000',
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await fetch(`https://people.googleapis.com/v1/people/me/connections?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) break;
    const data = await res.json();

    for (const person of data.connections || []) {
      const emails: { value: string }[] = person.emailAddresses || [];
      const name: string | null = person.names?.[0]?.displayName || null;
      const photo: string | null = person.photos?.[0]?.url || null;

      for (const { value: email } of emails) {
        if (email) {
          contacts.push({
            user_id: userId,
            email: email.toLowerCase(),
            name,
            photo_url: photo,
            source: 'google_contacts',
          });
        }
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  if (contacts.length === 0) return;

  // Upsert in batches of 500
  for (let i = 0; i < contacts.length; i += 500) {
    await supabase.from('contacts').upsert(
      contacts.slice(i, i + 500),
      { onConflict: 'user_id,email', ignoreDuplicates: false }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const providerToken = data.session.provider_token;
      const providerRefreshToken = data.session.provider_refresh_token;
      const userId = data.session.user.id;

      // Store Gmail tokens server-side in Supabase — never send to browser
      if (providerToken && userId) {
        await supabase.from('user_tokens').upsert(
          {
            user_id: userId,
            provider: 'gmail',
            access_token: providerToken,
            refresh_token: providerRefreshToken || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

        // Sync Google Contacts in background (non-blocking)
        syncGoogleContacts(supabase, userId, providerToken).catch(() => {});
      }

      // Check if user has completed onboarding
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('onboarded_at')
        .eq('user_id', userId)
        .single();

      const isOnboarded = !!prefs?.onboarded_at;
      const redirectPath = isOnboarded ? '/' : '/onboard';
      return NextResponse.redirect(`${origin}${redirectPath}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
