import { defineEnvVars } from '@sveltejs/kit/env';
import { z } from 'zod';

export const variables = defineEnvVars({
	PUBLIC_WHATSAPP_NUMBER: {
		public: true,
		description: 'Business WhatsApp number in international format, digits only',
		// Public, documented business number (CLAUDE.md); the default keeps tests and
		// fresh clones working without a local .env.
		schema: z
			.string()
			.regex(/^\d{10,15}$/, 'expected digits only, e.g. 529612423984')
			.default('529612423984')
	},
	PUBLIC_SUPABASE_URL: {
		public: true,
		description: 'Supabase project URL, e.g. https://<ref>.supabase.co',
		schema: z.url()
	},
	PUBLIC_SUPABASE_PUBLISHABLE_KEY: {
		public: true,
		description: 'Supabase publishable key (safe for the browser; RLS applies)',
		schema: z.string().min(1)
	},
	SUPABASE_SECRET_KEY: {
		description: 'Supabase secret key (bypasses RLS). Server only',
		schema: z.string().min(1)
	},
	PUBLIC_IMAGEKIT_URL_ENDPOINT: {
		public: true,
		description: 'ImageKit URL endpoint, e.g. https://ik.imagekit.io/<id>',
		schema: z.url()
	},
	PUBLIC_IMAGEKIT_PUBLIC_KEY: {
		public: true,
		description: 'ImageKit public key',
		schema: z.string().min(1)
	},
	IMAGEKIT_PRIVATE_KEY: {
		description: 'ImageKit private key, signs URLs and uploads. Server only',
		schema: z.string().min(1)
	}
});
