// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Admin } from '#lib/server/admin-auth.js';
import type { Database } from '#lib/types/database.js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Supabase client bound to the visitor's session (RLS applies). */
			supabase: SupabaseClient<Database>;
			/** Verified admin for `/admin` requests; always null elsewhere. */
			admin: Admin | null;
			/** Re-verifies the session, e.g. right after signing in within an action. */
			getAdmin: () => Promise<Admin | null>;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
