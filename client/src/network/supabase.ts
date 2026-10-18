// Supabase connection (Mayank). One client for the whole app, created on first use, and an
// anonymous sign-in so every tab is a player without an account (brief §12).
//
// Needs client/.env.local (never committed):
//   VITE_SUPABASE_URL=https://<project>.supabase.co
//   VITE_SUPABASE_ANON_KEY=sb_publishable_...   (the publishable/anon key, NEVER the secret one)

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

/** True when both env variables are set, so main.ts can fall back to local test rooms without them. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && key);
}

/**
 * A secret key skips every security rule, so it must never reach a browser. New-style secret keys
 * start with sb_secret_; old-style keys are JWTs whose payload says role "service_role".
 */
export function looksLikeSecretKey(k: string): boolean {
  if (k.startsWith('sb_secret_')) return true;
  const parts = k.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: unknown };
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (!url || !key) throw new Error('Online rooms are not set up (missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY).');
  if (looksLikeSecretKey(key)) {
    throw new Error('Refusing to start: VITE_SUPABASE_ANON_KEY is a secret key. Use the publishable (anon) key.');
  }
  client = createClient(url, key, {
    auth: {
      // sessionStorage, not localStorage: each tab is its own player, so two tabs can test a room.
      storage: window.sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

/** Signs in anonymously if this tab has no session yet. Returns the player's user id. */
export async function ensureSignedIn(supabase: SupabaseClient = getSupabase()): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: signIn, error } = await supabase.auth.signInAnonymously();
  if (error || !signIn.user) {
    throw new Error('Could not sign in to the game server. Check your connection and try again.');
  }
  return signIn.user.id;
}
