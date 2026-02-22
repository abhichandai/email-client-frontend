import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

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
          setAll(cookiesToSet) {
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
      }

      // Redirect to app — no tokens in URL anymore
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
