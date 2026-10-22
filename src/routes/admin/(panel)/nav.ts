import type { RouteId } from '$app/types';
import {
	type LucideIcon,
	FolderTree,
	House,
	Layers,
	Palette,
	Ruler,
	Shirt,
	ShoppingBag,
	Tags
} from '@lucide/svelte';

/** Panel routes without parameters: the only ones a menu item can point to. */
type StaticRoute = Exclude<RouteId, `${string}[${string}`>;

export type NavItem = {
	/** Public path, used to highlight the active item. */
	path: string;
	label: string;
	icon: LucideIcon;
	/** Route id once the screen exists; pending items render as "Próximamente". */
	route?: StaticRoute;
};

export const NAV: NavItem[] = [
	{ path: '/admin', label: 'Inicio', icon: House, route: '/admin/(panel)' },
	{
		path: '/admin/categorias',
		label: 'Categorías',
		icon: FolderTree,
		route: '/admin/(panel)/categorias'
	},
	{
		path: '/admin/colecciones',
		label: 'Colecciones',
		icon: Tags,
		route: '/admin/(panel)/colecciones'
	},
	{
		path: '/admin/prendas-base',
		label: 'Prendas base',
		icon: Shirt,
		route: '/admin/(panel)/prendas-base'
	},
	{ path: '/admin/disenos', label: 'Diseños', icon: Palette },
	{ path: '/admin/productos', label: 'Productos', icon: ShoppingBag },
	{ path: '/admin/tipos-de-prenda', label: 'Tallas y precios', icon: Ruler },
	{ path: '/admin/pedidos', label: 'Pedidos', icon: Layers }
];

export function isActive(path: string, pathname: string): boolean {
	return path === '/admin' ? pathname === '/admin' : pathname.startsWith(path);
}
