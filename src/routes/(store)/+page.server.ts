import { productImages, type ProductImage, type StoreProduct } from '#lib/domain/store-product.js';
import { loadCollections, loadReviews, loadStoreProducts, storeData } from '#lib/server/store.js';
import type { PageServerLoad } from './$types';

/** First image of a product, with the garment color hex for the backdrop tint. */
function cover(product: StoreProduct | undefined) {
	if (!product) return null;
	const image: ProductImage | undefined = productImages(product)[0];
	if (!image) return null;
	const hex = product.colorOptions.find((option) => option.key === image.key)?.hex ?? null;
	return { image, hex, blend: product.tipoImagen === 'mockup' };
}

export const load: PageServerLoad = async ({ parent }) => {
	const [products, collections, reviews] = await storeData(() =>
		Promise.all([loadStoreProducts(), loadCollections(), loadReviews()])
	);
	const { categories } = await parent();

	const featured = products.filter((product) => product.destacado);
	const heroProducts = (featured.length ? featured : products).slice(0, 3);
	const fandoms = collections
		.map((collection) => {
			const items = products.filter((product) => product.colecciones.includes(collection.slug));
			return { ...collection, count: items.length, cover: cover(items[0]) };
		})
		.filter((collection) => collection.count > 0);

	// The collection with the most products leads the editorial banner.
	const spotlight = [...fandoms].sort((a, b) => b.count - a.count)[0] ?? null;
	const spotlightProducts = spotlight
		? products.filter((product) => product.colecciones.includes(spotlight.slug)).slice(0, 2)
		: [];

	const categoryCovers = categories.map((root) => {
		const ids = [root.id, ...root.children.map((child) => child.id)];
		return {
			id: root.id,
			slug: root.slug,
			nombre: root.nombre,
			subcategorias: root.children.slice(0, 2).map((child) => child.nombre),
			cover: cover(products.find((product) => ids.includes(product.categoryId)))
		};
	});

	return {
		hero: heroProducts.map((product) => ({ product, cover: cover(product) })),
		fandoms,
		categoryCovers,
		newest: products.slice(0, 8),
		spotlight: spotlight
			? { ...spotlight, covers: spotlightProducts.map(cover).filter((item) => item !== null) }
			: null,
		ugc: reviews.filter((review) => review.foto).slice(0, 5),
		total: products.length
	};
};
