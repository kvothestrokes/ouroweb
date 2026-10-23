import type { RequestHandler } from './$types';

// Dynamic so the sitemap URL follows whatever domain serves the store.
export const GET: RequestHandler = ({ url, setHeaders }) => {
	setHeaders({
		'content-type': 'text/plain; charset=utf-8',
		'cache-control': 'public, max-age=3600'
	});
	return new Response(
		[
			'User-agent: *',
			'Disallow: /admin',
			'Disallow: /api/',
			'Disallow: /carrito',
			'Disallow: /checkout',
			'Disallow: /seguimiento',
			'Disallow: /favoritos',
			'Disallow: /buscar',
			'',
			`Sitemap: ${url.origin}/sitemap.xml`,
			''
		].join('\n')
	);
};
