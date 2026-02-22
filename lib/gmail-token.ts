import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fetches the Gmail access token for the current user from Supabase.
 * If the token is expired (Gmail returns 401), automatically refreshes it
 * using the stored refresh_token and saves the new token back to DB.
 */
export async function getGmailAccessToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('user_tokens')
    .select('access_token, refresh_token')
    .eq('user_id', userId)
    .single();

  if (error || !data?.access_token) {
    throw new Error('NO_GMAIL_TOKEN');
  }

  return data.access_token;
}

/**
 * Refreshes the Gmail access token using the stored refresh_token,
 * saves the new token to Supabase, and returns it.
 */
export async function refreshGmailToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('user_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .single();

  if (error || !data?.refresh_token) {
    throw new Error('NO_REFRESH_TOKEN');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google credentials not configured');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const tokenData = await res.json();
  if (!res.ok || !tokenData.access_token) {
    throw new Error(`Token refresh failed: ${tokenData.error || res.status}`);
  }

  // Save the new access token back to DB
  await supabase
    .from('user_tokens')
    .update({ access_token: tokenData.access_token, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  return tokenData.access_token;
}

/**
 * Gets a valid Gmail access token, refreshing automatically if needed.
 * Use this in all API routes instead of accepting tokens from the client.
 */
export async function getValidGmailToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const token = await getGmailAccessToken(supabase, userId);

  // Quick probe to check if token is still valid
  const probe = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (probe.status === 401) {
    // Token expired — refresh and return new one
    return await refreshGmailToken(supabase, userId);
  }

  if (!probe.ok) {
    throw new Error(`Gmail probe failed: ${probe.status}`);
  }

  return token;
}
