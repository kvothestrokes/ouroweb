// Smoke test of the linked Supabase database: RLS boundaries, atomic folio and seed.
// Run with `npm run db:smoke` (reads .env). Uses a far-future folio period (2099-01)
// and removes its counter afterwards, so real folios are never consumed.
import { createClient } from '@supabase/supabase-js';

const url = process.env.PUBLIC_SUPABASE_URL;
const publishableKey = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishableKey || !secretKey) {
	console.error(
		'Missing PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY'
	);
	process.exit(1);
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(url, publishableKey, options);
const admin = createClient(url, secretKey, options);

let failures = 0;
function check(name, ok, detail = '') {
	if (!ok) failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const PUBLIC_TABLES = [
	'categories',
	'collections',
	'garment_types',
	'garment_bases',
	'products',
	'product_colors',
	'product_images',
	'product_stock',
	'product_collections',
	'volume_pricing',
	'custom_request_types',
	'gallery_items'
];
const PRIVATE_TABLES = [
	'settings',
	'designs',
	'coupons',
	'folio_counters',
	'orders',
	'order_items',
	'custom_requests',
	'payments',
	'order_events',
	'order_notes',
	'order_files',
	'wa_templates'
];

// Public tables: anon can read.
for (const table of PUBLIC_TABLES) {
	const { error } = await anon.from(table).select('*').limit(1);
	check(`anon reads ${table}`, !error, error?.message);
}

// Reviews: anon reads the public columns but never the order they belong to.
{
	const { error } = await anon.from('reviews').select('id, calificacion, texto').limit(1);
	check('anon reads public review columns', !error, error?.message);
	const { error: orderError } = await anon.from('reviews').select('order_id').limit(1);
	check('anon cannot read reviews.order_id', Boolean(orderError), orderError?.code);
}

// Private tables: anon gets an error or zero rows, while the secret key sees the seed.
for (const table of PRIVATE_TABLES) {
	const { data, error } = await anon.from(table).select('*').limit(1);
	check(`anon cannot read ${table}`, Boolean(error) || data.length === 0, error?.code);
}

// Anon cannot write.
{
	const { error } = await anon.from('categories').insert({ slug: 'smoke-test', nombre: 'Smoke' });
	check('anon cannot insert categories', Boolean(error), error?.code);
	const { error: orderError } = await anon.from('orders').insert({
		folio: 'OUR-9901-0001',
		tipo: 'catalogo',
		cliente_nombre: 'Smoke',
		cliente_whatsapp: '520000000000',
		metodo_entrega: 'recoger',
		subtotal: 0,
		total: 0
	});
	check('anon cannot insert orders', Boolean(orderError), orderError?.code);
}

// Inactive catalog is hidden from anon.
{
	const slug = 'smoke-inactiva';
	await admin.from('categories').delete().eq('slug', slug);
	const { error } = await admin.from('categories').insert({ slug, nombre: 'Smoke', activo: false });
	check('secret key inserts an inactive category', !error, error?.message);
	const { data } = await anon.from('categories').select('id').eq('slug', slug);
	check('anon does not see inactive categories', data?.length === 0);
	await admin.from('categories').delete().eq('slug', slug);
}

// Children of inactive products are hidden from anon.
{
	const slug = 'smoke-producto-inactivo';
	await admin.from('products').delete().eq('slug', slug);
	const { data: category } = await admin
		.from('categories')
		.select('id')
		.eq('slug', 'tazas')
		.single();
	const { data: product, error } = await admin
		.from('products')
		.insert({
			slug,
			nombre: 'Smoke',
			category_id: category?.id,
			tipo_imagen: 'foto',
			precio_base: 100
		})
		.select('id')
		.single();
	check('secret key inserts an inactive product', !error, error?.message);
	if (product) {
		await admin
			.from('product_images')
			.insert({ product_id: product.id, imagekit_path: '/smoke.jpg' });
		const { data: products } = await anon.from('products').select('id').eq('id', product.id);
		check('anon does not see inactive products', products?.length === 0);
		const { data: images } = await anon
			.from('product_images')
			.select('id')
			.eq('product_id', product.id);
		check('anon does not see images of inactive products', images?.length === 0);
		await admin.from('products').delete().eq('id', product.id);
	}
}

// Folio: anon cannot call it; the secret key gets unique consecutive folios.
{
	const { error } = await anon.rpc('next_folio', { p_fecha: '2099-01-15T12:00:00Z' });
	check('anon cannot call next_folio', Boolean(error), error?.code);

	await admin.from('folio_counters').delete().eq('periodo', '9901');
	const calls = Array.from({ length: 20 }, () =>
		admin.rpc('next_folio', { p_fecha: '2099-01-15T12:00:00Z' })
	);
	const results = await Promise.all(calls);
	const folios = results.map((r) => r.data).sort();
	const expected = Array.from(
		{ length: 20 },
		(_, i) => `OUR-9901-${String(i + 1).padStart(4, '0')}`
	);
	check(
		'20 concurrent next_folio calls return OUR-9901-0001..0020',
		results.every((r) => !r.error) && JSON.stringify(folios) === JSON.stringify(expected),
		results.find((r) => r.error)?.error.message ?? folios.slice(0, 3).join(',')
	);

	const { data: nextMonth } = await admin.rpc('next_folio', { p_fecha: '2099-02-01T06:30:00Z' });
	check('counter restarts for a new month', nextMonth === 'OUR-9902-0001', nextMonth);

	// 2099-02-01 05:59 UTC is still January in Mexico City (UTC-6).
	const { data: tz } = await admin.rpc('next_folio', { p_fecha: '2099-02-01T05:59:00Z' });
	check('period uses America/Mexico_City time', tz === 'OUR-9901-0021', tz);

	const { error: prefixError } = await admin.rpc('next_folio', { p_prefijo: 'bad' });
	check('invalid prefix is rejected', Boolean(prefixError), prefixError?.code);

	await admin.from('folio_counters').delete().in('periodo', ['9901', '9902']);
}

// Garment types: real sizes and global prices (migration precios_y_tallas).
{
	const { data: playera } = await anon
		.from('garment_types')
		.select('id, tallas, precio_normal, precio_mayoreo')
		.eq('nombre', 'Playera')
		.single();
	check(
		'Playera sizes are CH, M, G, XG, XXG',
		JSON.stringify(playera?.tallas) === JSON.stringify(['CH', 'M', 'G', 'XG', 'XXG']),
		JSON.stringify(playera?.tallas)
	);
	check(
		'Playera prices are $170 normal and $150 mayoreo (cents)',
		playera?.precio_normal === 17000 && playera?.precio_mayoreo === 15000,
		`${playera?.precio_normal}/${playera?.precio_mayoreo}`
	);

	const { data: category } = await admin
		.from('categories')
		.select('id')
		.eq('slug', 'tazas')
		.single();
	const { error: noPrice } = await admin.from('products').insert({
		slug: 'smoke-sin-precio',
		nombre: 'Smoke',
		category_id: category?.id,
		tipo_imagen: 'foto'
	});
	check('a product without garment type requires precio_base', Boolean(noPrice), noPrice?.code);

	const { data: garment, error: garmentError } = await admin
		.from('products')
		.insert({
			slug: 'smoke-precio-global',
			nombre: 'Smoke',
			category_id: category?.id,
			tipo_imagen: 'foto',
			garment_type_id: playera?.id
		})
		.select('id')
		.single();
	check('a garment product may omit precio_base', !garmentError, garmentError?.message);
	if (garment) await admin.from('products').delete().eq('id', garment.id);
	await admin.from('products').delete().eq('slug', 'smoke-sin-precio');
}

// Seed is present.
{
	const { count: categories } = await admin
		.from('categories')
		.select('*', { count: 'exact', head: true });
	check('seed: 20 categories', categories === 20, String(categories));
	const { count: templates } = await admin
		.from('wa_templates')
		.select('*', { count: 'exact', head: true });
	check('seed: 9 WhatsApp templates', templates === 9, String(templates));
	const { data: settings } = await admin.from('settings').select('whatsapp_negocio').single();
	check('seed: settings row', settings?.whatsapp_negocio === '529612423984');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
