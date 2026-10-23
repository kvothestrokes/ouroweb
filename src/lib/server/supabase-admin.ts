import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SECRET_KEY } from '$app/env/private';
import { PUBLIC_SUPABASE_URL } from '$app/env/public';
import type { Database } from '#lib/types/database.js';

/**
 * Secret-key client: bypasses RLS. Server only, and only where the server needs data the
 * public must never read directly (e.g. design paths to compose a mockup) or writes that
 * endpoints validate themselves (orders, Fase 4).
 */
export const supabaseAdmin = createClient<Database>(PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
	auth: { persistSession: false, autoRefreshToken: false }
});
