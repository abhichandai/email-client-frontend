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
      // Pass provider_token via URL so client can store it for Gmail API calls
      const providerToken = data.session.provider_token || '';
      const providerRefreshToken = data.session.provider_refresh_token || '';
      const userEmail = data.session.user.email || '';
      const userId = data.session.user.id || '';

      const redirectUrl = new URL('/', origin);
      if (providerToken) {
        redirectUrl.searchParams.set('pt', providerToken);
        redirectUrl.searchParams.set('prt', providerRefreshToken);
        redirectUrl.searchParams.set('ue', userEmail);
        redirectUrl.searchParams.set('uid', userId);
      }
      return NextResponse.redirect(redirectUrl.toString());
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
