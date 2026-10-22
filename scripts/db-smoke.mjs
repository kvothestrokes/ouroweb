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
// Tables where anon only gets some columns (paths and design ids stay private).
const PUBLIC_COLUMNS = {
	products:
		'id, slug, nombre, descripcion, category_id, tipo_imagen, garment_type_id, precio_base, modo_stock, permite_personalizar, activo, destacado, created_at, updated_at',
	product_images: 'id, product_id, orden, created_at'
};
for (const table of PUBLIC_TABLES) {
	const { error } = await anon
		.from(table)
		.select(PUBLIC_COLUMNS[table] ?? '*')
		.limit(1);
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

// Garment bases point to a local photo key "<type>/<color>".
{
	const { data: playera } = await admin
		.from('garment_types')
		.select('id')
		.eq('nombre', 'Playera')
		.single();
	const row = (foto) => ({
		garment_type_id: playera?.id,
		color_nombre: `Smoke ${foto}`,
		color_hex: '#000000',
		foto,
		area_impresion: { x: 1, y: 1, ancho: 1 }
	});
	const { error: badPath } = await admin.from('garment_bases').insert(row('../secret'));
	check(
		'garment base rejects a photo key outside "<type>/<color>"',
		Boolean(badPath),
		badPath?.code
	);
	const { data: ok, error: okError } = await admin
		.from('garment_bases')
		.insert(row('playera/smoke-color'))
		.select('id')
		.single();
	check('garment base accepts "playera/smoke-color"', !okError, okError?.message);
	if (ok) await admin.from('garment_bases').delete().eq('id', ok.id);
}

// save_product: one transaction for the product, its colors, collections and stock.
{
	const { error: anonError } = await anon.rpc('save_product', {
		p_id: null,
		p_product: {},
		p_colors: [],
		p_collections: [],
		p_stock: []
	});
	check('anon cannot call save_product', Boolean(anonError), anonError?.code);

	const one = async (query) => (await query).data;
	const playera = await one(
		admin.from('garment_types').select('id').eq('nombre', 'Playera').single()
	);
	const category = await one(
		admin.from('categories').select('id').eq('slug', 'playeras-con-diseno').single()
	);
	const [negro, blanco] = await Promise.all(
		['playera/negro', 'playera/blanco'].map((foto) =>
			one(admin.from('garment_bases').select('id').eq('foto', foto).single())
		)
	);
	await admin.from('designs').delete().eq('nombre', 'Smoke diseño');
	await admin.from('collections').delete().eq('slug', 'smoke-coleccion');
	await admin.from('products').delete().eq('slug', 'smoke-producto');
	await admin.from('garment_types').delete().eq('nombre', 'Smoke tipo');
	const design = await one(
		admin
			.from('designs')
			.insert({ nombre: 'Smoke diseño', path_prenda_oscura: '/smoke/d.png' })
			.select('id')
			.single()
	);
	const collection = await one(
		admin
			.from('collections')
			.insert({ slug: 'smoke-coleccion', nombre: 'Smoke' })
			.select('id')
			.single()
	);
	const otherType = await one(
		admin
			.from('garment_types')
			.insert({ nombre: 'Smoke tipo', tallas: ['M'] })
			.select('id')
			.single()
	);
	const otherBase = await one(
		admin
			.from('garment_bases')
			.insert({
				garment_type_id: otherType?.id,
				color_nombre: 'Smoke',
				color_hex: '#000000',
				foto: 'smoke-tipo/negro',
				area_impresion: { x: 1, y: 1, ancho: 1 }
			})
			.select('id')
			.single()
	);

	const product = {
		slug: 'smoke-producto',
		nombre: 'Smoke producto',
		descripcion: '',
		category_id: category?.id,
		tipo_imagen: 'mockup',
		garment_type_id: playera?.id,
		design_id: design?.id,
		precio_base: null,
		modo_stock: 'stock',
		permite_personalizar: false,
		activo: false,
		destacado: false
	};
	const counts = async (id) => ({
		colors: (
			await admin
				.from('product_colors')
				.select('*', { count: 'exact', head: true })
				.eq('product_id', id)
		).count,
		collections: (
			await admin
				.from('product_collections')
				.select('*', { count: 'exact', head: true })
				.eq('product_id', id)
		).count,
		stock: (
			await admin
				.from('product_stock')
				.select('*', { count: 'exact', head: true })
				.eq('product_id', id)
		).count
	});

	const { data: id, error: createError } = await admin.rpc('save_product', {
		p_id: null,
		p_product: product,
		p_colors: [negro?.id, blanco?.id],
		p_collections: [collection?.id],
		p_stock: [
			{ garment_base_id: negro?.id, talla: 'M', cantidad: 3 },
			{ garment_base_id: blanco?.id, talla: 'G', cantidad: 0 }
		]
	});
	check(
		'save_product creates a product with its colors, collections and stock',
		!createError && Boolean(id),
		createError?.message
	);
	if (id) {
		const created = await counts(id);
		check(
			'creation stored 2 colors, 1 collection and 2 stock rows',
			created.colors === 2 && created.collections === 1 && created.stock === 2,
			JSON.stringify(created)
		);

		const { error: updateError } = await admin.rpc('save_product', {
			p_id: id,
			p_product: { ...product, nombre: 'Smoke producto 2', modo_stock: 'bajo_pedido' },
			p_colors: [negro?.id],
			p_collections: [],
			p_stock: []
		});
		const updated = await counts(id);
		const { data: row } = await admin
			.from('products')
			.select('nombre, modo_stock')
			.eq('id', id)
			.single();
		check(
			'update replaces colors, collections and stock',
			!updateError &&
				updated.colors === 1 &&
				updated.collections === 0 &&
				updated.stock === 0 &&
				row?.nombre === 'Smoke producto 2',
			updateError?.message ?? JSON.stringify(updated)
		);

		const { error: foreignColor } = await admin.rpc('save_product', {
			p_id: id,
			p_product: product,
			p_colors: [negro?.id, otherBase?.id],
			p_collections: [],
			p_stock: []
		});
		check(
			'a color of another garment type is rejected',
			Boolean(foreignColor),
			foreignColor?.message
		);

		const { error: stockOutside } = await admin.rpc('save_product', {
			p_id: id,
			p_product: product,
			p_colors: [negro?.id],
			p_collections: [collection?.id],
			p_stock: [{ garment_base_id: blanco?.id, talla: 'M', cantidad: 1 }]
		});
		check(
			'stock for a color the product does not have is rejected',
			Boolean(stockOutside),
			stockOutside?.message
		);

		const { error: badSize } = await admin.rpc('save_product', {
			p_id: id,
			p_product: product,
			p_colors: [negro?.id],
			p_collections: [],
			p_stock: [{ garment_base_id: negro?.id, talla: '3XL', cantidad: 1 }]
		});
		check(
			'stock for a size the garment type does not have is rejected',
			Boolean(badSize),
			badSize?.message
		);

		const after = await counts(id);
		check(
			'a rejected save leaves the previous colors and collections untouched',
			after.colors === 1 && after.collections === 0,
			JSON.stringify(after)
		);
		await admin.from('products').delete().eq('id', id);
	}
	await admin.from('garment_bases').delete().eq('foto', 'smoke-tipo/negro');
	await admin.from('garment_types').delete().eq('nombre', 'Smoke tipo');
	await admin.from('collections').delete().eq('slug', 'smoke-coleccion');
	await admin.from('designs').delete().eq('nombre', 'Smoke diseño');
}

// Seed is present.
// create_order: one transaction for folio + order + items + first event (Fase 4).
{
	const fecha = '2099-03-10T12:00:00Z';
	const cleanup = async () => {
		await admin.from('orders').delete().like('folio', 'OUR-9903-%');
		await admin.from('folio_counters').delete().eq('periodo', '9903');
	};
	await cleanup();
	const order = {
		cliente_nombre: 'Smoke',
		cliente_whatsapp: '520000000000',
		metodo_entrega: 'recoger',
		direccion: null,
		notas_cliente: '',
		subtotal: 37000,
		desc_mayoreo: 0
	};
	const items = [
		{
			product_id: null,
			nombre_snapshot: 'Playera',
			color: 'Negro',
			talla: 'M',
			cantidad: 1,
			precio_unitario: 17000,
			recargo_talla: 0,
			personalizacion_texto: null
		},
		{
			product_id: null,
			nombre_snapshot: 'Playera',
			color: 'Negro',
			talla: 'XXG',
			cantidad: 1,
			precio_unitario: 17000,
			recargo_talla: 3000,
			personalizacion_texto: 'Ana'
		}
	];
	const { error: anonError } = await anon.rpc('create_order', {
		p_order: order,
		p_items: items,
		p_fecha: fecha
	});
	check('anon cannot call create_order', Boolean(anonError), anonError?.code);

	const { data: folio, error } = await admin.rpc('create_order', {
		p_order: order,
		p_items: items,
		p_fecha: fecha
	});
	check('create_order returns the folio', folio === 'OUR-9903-0001', error?.message ?? folio);
	const { data: saved } = await admin
		.from('orders')
		.select('estado, total, envio, order_items(id), order_events(estado)')
		.eq('folio', 'OUR-9903-0001')
		.maybeSingle();
	check(
		'create_order saves totals, items and the first event',
		saved?.estado === 'pendiente' &&
			saved.total === 37000 &&
			saved.envio === 0 &&
			saved.order_items.length === 2 &&
			saved.order_events[0]?.estado === 'pendiente',
		JSON.stringify(saved)
	);

	const { error: badTotal } = await admin.rpc('create_order', {
		p_order: { ...order, subtotal: 1 },
		p_items: items,
		p_fecha: fecha
	});
	check(
		'create_order rejects a subtotal that does not match its items',
		Boolean(badTotal),
		badTotal?.message
	);

	for (let i = 0; i < 4; i++)
		await admin.rpc('create_order', { p_order: order, p_items: items, p_fecha: fecha });
	const { error: spam } = await admin.rpc('create_order', {
		p_order: order,
		p_items: items,
		p_fecha: fecha
	});
	check(
		'create_order limits pending orders per WhatsApp per hour',
		spam?.message === 'too_many_orders',
		spam?.message
	);

	const { error: negative } = await admin.rpc('create_order', {
		p_order: { ...order, cliente_whatsapp: '520000000001', subtotal: -17000 },
		p_items: [{ ...items[0], cantidad: -1 }],
		p_fecha: fecha
	});
	check('create_order rejects non-positive quantities', Boolean(negative), negative?.message);
	const { error: bigDiscount } = await admin.rpc('create_order', {
		p_order: { ...order, cliente_whatsapp: '520000000001', desc_mayoreo: 40000 },
		p_items: items,
		p_fecha: fecha
	});
	check(
		'create_order rejects a discount larger than the subtotal',
		Boolean(bigDiscount),
		bigDiscount?.message
	);

	// Global cap so random phone numbers cannot burn the 9999 monthly folios.
	await cleanup();
	const burst = await Promise.all(
		Array.from({ length: 61 }, (_, i) =>
			admin.rpc('create_order', {
				p_order: { ...order, cliente_whatsapp: `5299${String(i).padStart(8, '0')}` },
				p_items: items,
				p_fecha: fecha
			})
		)
	);
	const busy = burst.filter((result) => result.error?.message === 'store_busy').length;
	check(
		'create_order caps pending orders per hour across all numbers',
		busy === 1,
		`${busy} rejected`
	);
	await cleanup();
}

// create_custom_order: special requests are orders of type "encargo" (Fase 5).
{
	const fecha = '2099-04-10T12:00:00Z';
	const cleanup = async () => {
		await admin.from('orders').delete().like('folio', 'OUR-9904-%');
		await admin.from('folio_counters').delete().eq('periodo', '9904');
	};
	await cleanup();
	const order = {
		cliente_nombre: 'Smoke',
		cliente_whatsapp: '520000000002',
		metodo_entrega: 'paqueteria',
		direccion: {
			calle: 'X 1',
			colonia: 'Centro',
			cp: '29000',
			ciudad: 'Tuxtla',
			estado: 'Chiapas',
			referencias: ''
		},
		notas_cliente: ''
	};
	const request = {
		custom_request_type_id: null,
		descripcion: 'Termo con mi nombre',
		cantidad: 3,
		fecha_deseada: '2099-05-01'
	};
	const { error: anonError } = await anon.rpc('create_custom_order', {
		p_order: order,
		p_request: request,
		p_fecha: fecha
	});
	check('anon cannot call create_custom_order', Boolean(anonError), anonError?.code);

	const { data: folio, error } = await admin.rpc('create_custom_order', {
		p_order: order,
		p_request: request,
		p_fecha: fecha
	});
	check(
		'create_custom_order returns the folio',
		folio === 'OUR-9904-0001',
		error?.message ?? folio
	);
	const { data: saved } = await admin
		.from('orders')
		.select(
			'tipo, estado, subtotal, envio, total, custom_requests(descripcion, cantidad, precio_final), order_events(estado)'
		)
		.eq('folio', 'OUR-9904-0001')
		.maybeSingle();
	check(
		'create_custom_order saves an encargo to be quoted',
		saved?.tipo === 'encargo' &&
			saved.subtotal === 0 &&
			saved.envio === null &&
			saved.total === 0 &&
			saved.custom_requests?.cantidad === 3 &&
			saved.custom_requests.precio_final === null &&
			saved.order_events[0]?.estado === 'pendiente',
		JSON.stringify(saved)
	);
	const { error: emptyError } = await admin.rpc('create_custom_order', {
		p_order: order,
		p_request: { ...request, descripcion: ' ' },
		p_fecha: fecha
	});
	check('create_custom_order requires a description', Boolean(emptyError), emptyError?.code);

	const { data: hiddenType } = await admin
		.from('custom_request_types')
		.insert({ nombre: 'Smoke tipo oculto', activo: false })
		.select('id')
		.single();
	const { error: hiddenError } = await admin.rpc('create_custom_order', {
		p_order: { ...order, cliente_whatsapp: '520000000003' },
		p_request: { ...request, custom_request_type_id: hiddenType?.id },
		p_fecha: fecha
	});
	check(
		'create_custom_order rejects hidden request types',
		Boolean(hiddenError),
		hiddenError?.message
	);
	await admin.from('custom_request_types').delete().eq('nombre', 'Smoke tipo oculto');

	// Requests get their own cap inside the store-wide one, so they cannot block catalog orders.
	await cleanup();
	const burst = await Promise.all(
		Array.from({ length: 21 }, (_, i) =>
			admin.rpc('create_custom_order', {
				p_order: { ...order, cliente_whatsapp: `5298${String(i).padStart(8, '0')}` },
				p_request: request,
				p_fecha: fecha
			})
		)
	);
	const busy = burst.filter((result) => result.error?.message === 'store_busy').length;
	check('special requests are capped at 20 per hour', busy === 1, `${busy} rejected`);
	await cleanup();
}

// Admin order management (Fase 6): quote, status changes with history, payments.
{
	const fecha = '2099-05-10T12:00:00Z';
	const cleanup = async () => {
		await admin.from('orders').delete().like('folio', 'OUR-9905-%');
		await admin.from('folio_counters').delete().eq('periodo', '9905');
	};
	await cleanup();
	const { data: folio } = await admin.rpc('create_order', {
		p_order: {
			cliente_nombre: 'Smoke',
			cliente_whatsapp: '520000000005',
			metodo_entrega: 'paqueteria',
			direccion: { calle: 'X' },
			notas_cliente: '',
			subtotal: 34000,
			desc_mayoreo: 0
		},
		p_items: [
			{
				product_id: null,
				nombre_snapshot: 'Playera',
				color: 'Negro',
				talla: 'M',
				cantidad: 2,
				precio_unitario: 17000,
				recargo_talla: 0,
				personalizacion_texto: 'Ana'
			}
		],
		p_fecha: fecha
	});
	const { data: order } = await admin.from('orders').select('id').eq('folio', folio).single();
	const id = order?.id;

	const { error: anonQuote } = await anon.rpc('quote_order', {
		p_order_id: id,
		p_envio: 15000,
		p_personalizacion: 5000,
		p_precio_final: null,
		p_anticipo: 27000
	});
	check('anon cannot quote orders', Boolean(anonQuote), anonQuote?.code);

	const { error: quoteError } = await admin.rpc('quote_order', {
		p_order_id: id,
		p_envio: 15000,
		p_personalizacion: 5000,
		p_precio_final: null,
		p_anticipo: 27000
	});
	const { data: quoted } = await admin
		.from('orders')
		.select('total, anticipo_requerido')
		.eq('id', id)
		.single();
	check(
		'quote_order recomputes the total',
		!quoteError && quoted?.total === 54000 && quoted.anticipo_requerido === 27000,
		quoteError?.message ?? JSON.stringify(quoted)
	);

	const { error: skip } = await admin.rpc('change_order_status', {
		p_order_id: id,
		p_estado: 'en_produccion',
		p_nota: null
	});
	check('change_order_status rejects skipping states', Boolean(skip), skip?.message);
	await admin.rpc('change_order_status', {
		p_order_id: id,
		p_estado: 'esperando_anticipo',
		p_nota: null
	});
	const { error: noDeposit } = await admin.rpc('change_order_status', {
		p_order_id: id,
		p_estado: 'confirmado',
		p_nota: null
	});
	check(
		'confirming requires a deposit payment',
		noDeposit?.message === 'deposit_required',
		noDeposit?.message
	);

	const { error: tooMuch } = await admin.rpc('add_payment', {
		p_order_id: id,
		p_tipo: 'anticipo',
		p_monto: 60000,
		p_metodo: 'Transferencia',
		p_fecha: null
	});
	check(
		'add_payment rejects more than the balance',
		tooMuch?.message === 'payment_exceeds_balance',
		tooMuch?.message
	);
	const { error: payError } = await admin.rpc('add_payment', {
		p_order_id: id,
		p_tipo: 'anticipo',
		p_monto: 27000,
		p_metodo: 'Transferencia',
		p_fecha: null
	});
	check('add_payment registers the deposit', !payError, payError?.message);
	const { error: confirmError } = await admin.rpc('change_order_status', {
		p_order_id: id,
		p_estado: 'confirmado',
		p_nota: 'Anticipo recibido'
	});
	check('a paid deposit confirms the order', !confirmError, confirmError?.message);
	await admin.rpc('change_order_status', {
		p_order_id: id,
		p_estado: 'en_produccion',
		p_nota: null
	});
	await admin.rpc('change_order_status', { p_order_id: id, p_estado: 'listo', p_nota: null });
	const { error: wrongBranch } = await admin.rpc('change_order_status', {
		p_order_id: id,
		p_estado: 'listo_para_recoger',
		p_nota: null
	});
	check('parcel orders cannot go to pickup', Boolean(wrongBranch), wrongBranch?.message);
	await admin.rpc('add_payment', {
		p_order_id: id,
		p_tipo: 'abono',
		p_monto: 27000,
		p_metodo: 'Efectivo',
		p_fecha: null
	});
	const { error: belowPaid } = await admin.rpc('quote_order', {
		p_order_id: id,
		p_envio: 0,
		p_personalizacion: 0,
		p_precio_final: null,
		p_anticipo: 27000
	});
	check(
		'quote_order cannot go below what was paid',
		belowPaid?.message === 'quote_below_paid',
		belowPaid?.message
	);
	const { error: bigDeposit } = await admin.rpc('quote_order', {
		p_order_id: id,
		p_envio: 15000,
		p_personalizacion: 5000,
		p_precio_final: null,
		p_anticipo: 99000
	});
	check(
		'quote_order rejects a deposit above the total',
		bigDeposit?.message === 'deposit_above_total',
		bigDeposit?.message
	);
	const { data: events } = await admin
		.from('order_events')
		.select('estado')
		.eq('order_id', id)
		.order('fecha');
	check(
		'every status change is in the history',
		events?.map((event) => event.estado).join(',') ===
			'pendiente,esperando_anticipo,confirmado,en_produccion,listo',
		events?.map((event) => event.estado).join(',')
	);
	await cleanup();
}

// Durable rate limits shared by every server instance (Fase 7).
{
	const key = `smoke:${Date.now()}`;
	const { error: anonError } = await anon.rpc('hit_rate_limit', {
		p_key: key,
		p_limit: 2,
		p_window_seconds: 60
	});
	check('anon cannot call hit_rate_limit', Boolean(anonError), anonError?.code);
	const hits = [];
	for (let i = 0; i < 3; i++) {
		const { data } = await admin.rpc('hit_rate_limit', {
			p_key: key,
			p_limit: 2,
			p_window_seconds: 60
		});
		hits.push(data);
	}
	check(
		'hit_rate_limit allows up to the limit in the window',
		JSON.stringify(hits) === '[true,true,false]',
		JSON.stringify(hits)
	);
	await admin.from('rate_limits').delete().eq('key', key);
}

// One review per order.
{
	const fecha = '2099-06-10T12:00:00Z';
	await admin.from('orders').delete().like('folio', 'OUR-9906-%');
	await admin.from('folio_counters').delete().eq('periodo', '9906');
	const { data: folio } = await admin.rpc('create_order', {
		p_order: {
			cliente_nombre: 'Smoke',
			cliente_whatsapp: '520000000006',
			metodo_entrega: 'recoger',
			direccion: null,
			notas_cliente: '',
			subtotal: 17000,
			desc_mayoreo: 0
		},
		p_items: [
			{
				product_id: null,
				nombre_snapshot: 'Playera',
				color: null,
				talla: 'M',
				cantidad: 1,
				precio_unitario: 17000,
				recargo_talla: 0,
				personalizacion_texto: null
			}
		],
		p_fecha: fecha
	});
	const { data: order } = await admin.from('orders').select('id').eq('folio', folio).single();
	await admin.from('reviews').insert({ order_id: order?.id, calificacion: 5, texto: 'Bien' });
	const { error: second } = await admin
		.from('reviews')
		.insert({ order_id: order?.id, calificacion: 4, texto: 'Otra' });
	check('an order takes a single review', second?.code === '23505', second?.code);
	await admin.from('orders').delete().like('folio', 'OUR-9906-%');
	await admin.from('folio_counters').delete().eq('periodo', '9906');
}

// Private columns of public tables: original photo paths and design ids.
{
	const { error: designError } = await anon.from('products').select('design_id').limit(1);
	check('anon cannot read products.design_id', Boolean(designError), designError?.code);
	const { error: pathError } = await anon.from('product_images').select('imagekit_path').limit(1);
	check('anon cannot read product_images.imagekit_path', Boolean(pathError), pathError?.code);
}

// Active products inside a hidden category (or under a hidden root) are hidden too.
{
	await admin.from('products').delete().like('slug', 'smoke-oculto-%');
	await admin.from('categories').delete().eq('slug', 'smoke-raiz-oculta-sub');
	await admin.from('categories').delete().like('slug', 'smoke-raiz-oculta%');
	const { data: root } = await admin
		.from('categories')
		.insert({ slug: 'smoke-raiz-oculta', nombre: 'Smoke raíz', activo: false })
		.select('id')
		.single();
	const { data: sub } = await admin
		.from('categories')
		.insert({
			slug: 'smoke-raiz-oculta-sub',
			nombre: 'Smoke sub',
			parent_id: root?.id,
			activo: true
		})
		.select('id')
		.single();
	const { data: products, error } = await admin
		.from('products')
		.insert([
			{
				slug: 'smoke-oculto-raiz',
				nombre: 'Smoke',
				category_id: root?.id,
				tipo_imagen: 'foto',
				precio_base: 100,
				activo: true
			},
			{
				slug: 'smoke-oculto-sub',
				nombre: 'Smoke',
				category_id: sub?.id,
				tipo_imagen: 'foto',
				precio_base: 100,
				activo: true
			}
		])
		.select('id');
	check('secret key inserts active products in hidden categories', !error, error?.message);
	const { data: visible } = await anon
		.from('products')
		.select('slug')
		.in(
			'id',
			(products ?? []).map((product) => product.id)
		);
	check(
		'anon does not see products of a hidden category',
		visible?.length === 0,
		JSON.stringify(visible)
	);
	await admin.from('products').delete().like('slug', 'smoke-oculto-%');
	await admin.from('categories').delete().eq('slug', 'smoke-raiz-oculta-sub');
	await admin.from('categories').delete().eq('slug', 'smoke-raiz-oculta');
}

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
