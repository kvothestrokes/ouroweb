---
name: ouroboros-ui
description: Sistema de diseño de la tienda Ouroboros (dos temas: día predeterminado papel + tinta + dorado, y noche negro + dorado; acento morado; Tailwind v4, shadcn-svelte, Svelte 5). Úsala siempre que crees o modifiques una página, componente, layout o estilo de la tienda o del panel de admin, o cuando pidan que algo "se vea mejor".
---

# Ouroboros — sistema de diseño

## Dirección visual

Moda en línea (Zara, H&M, Uniqlo, Shein): mucha imagen, tipografía grande, grids limpios, aire generoso. Dos temas: **día** (predeterminado: papel cálido, tinta y dorado) y **noche** (negro y dorado). `<html class="dark">` activa noche; el interruptor es `ThemeToggle` y la elección se guarda en `localStorage` (`ouroboros:tema`). Los componentes solo usan tokens: nunca `dark:` salvo un ajuste puntual.

- **Dorado tiene dos roles:** `text-gold` es dorado para texto (oscuro de día para pasar AA) y `bg-gold-fill` es el dorado de superficie, con texto `text-on-gold`.
- **CTA principal:** `bg-primary text-primary-foreground hover:bg-primary-hover` (tinta de día, dorado de noche).
- **Ofertas:** `text-sale` / `bg-sale`.
- **Fotos de prenda:** `ProtectedImage` con `tint={stageTint(hex)}` y `blend` (multiplica la foto de fondo blanco sobre un pastel del color). El escenario es claro en ambos temas.
- **Chips sobre fotos:** `bg-overlay text-overlay-foreground` (iguales en ambos temas).

## Tokens (definidos en `src/app.css`)

| Uso                                               | Clase Tailwind                                        |
| ------------------------------------------------- | ----------------------------------------------------- |
| Fondo de página                                   | `bg-background`                                       |
| Cards y paneles                                   | `bg-card` / `bg-surface`                              |
| Hover, modales, fondo de imagen                   | `bg-surface-raised`                                   |
| Texto                                             | `text-foreground`, secundario `text-muted-foreground` |
| CTA principal, precios, logo                      | `bg-primary text-primary-foreground`, `text-gold`     |
| Hover de CTA                                      | `hover:bg-gold-light`                                 |
| Acentos: chips activos, badges de fandom, enlaces | `bg-accent`, `text-purple-light`                      |
| Bordes                                            | `border-border`                                       |
| Estados                                           | `text-success`, `text-warning`, `text-danger`         |

**Prohibido** usar hex o colores de la paleta por defecto de Tailwind (`bg-zinc-900`, `text-yellow-500`…). Si falta un token, agrégalo en `src/app.css`.

## Tipografía

- Títulos (`h1`–`h3`, nombres de categoría, hero): `font-display` (Cinzel).
- Todo lo demás: `font-sans` (Inter).
- Precios: `font-sans font-semibold tabular-nums text-gold`.
- Formato de dinero: `Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })`, en una utilidad compartida `src/lib/domain/money.ts`.

## Patrones de la tienda

**Navbar:** logo a la izquierda; categorías principales al centro (escritorio) o en menú lateral (móvil); a la derecha búsqueda, favoritos, carrito con contador y botón dorado "Encargos especiales".

**Submenú de categoría** (`CategorySubnav`): fila de chips debajo del navbar con las subcategorías; el activo con `bg-accent`. En móvil, scroll horizontal con `overflow-x-auto` y sin barra visible.

**Hero de categoría estrella** (`CategoryHero`): imagen amplia, título en `font-display`, una línea de texto y un CTA dorado.

**ProductCard:**

- Contenedor de imagen con `product-stage` y proporción `aspect-[4/5]`.
- Imagen con `image-guard`, `loading="lazy"`, `srcset` y placeholder borroso.
- `ColorSwatches` debajo de la imagen: círculos de 20–24 px con borde `border-border`; el seleccionado con anillo `ring-2 ring-gold`. Hover (escritorio) o tap (móvil) cambia la imagen sin recargar. Cada swatch es un `button` con `aria-label="Color negro"` y `aria-pressed`.
- Nombre (2 líneas máx.), precio "desde" en dorado, badge de fandom (`bg-accent/20 text-purple-light`) y badge "En stock" / "Bajo pedido".
- Corazón de favorito en la esquina superior derecha de la imagen.
- Hover en escritorio: ligera elevación y zoom de imagen ≤ 1.03.

**Grid:** 2 columnas en móvil, 3 en tablet, 4 en escritorio; `gap-4 md:gap-6`.

**Página de producto:** galería a la izquierda y panel de compra fijo (`sticky`) a la derecha en escritorio; en móvil, galería arriba y barra inferior fija con precio y "Agregar al carrito".

## Panel de admin

Mismo tema, más denso: tablas con filas de 48 px, filtros arriba, badges de estado con color semántico. El botón "Avisar por WhatsApp" usa ícono de WhatsApp y estilo secundario. Los pedidos nuevos llegan con un aviso tipo toast.

## Estados obligatorios

Toda vista que carga datos necesita: **cargando** (skeletons con `bg-surface-raised animate-pulse`), **vacío** (mensaje amable + acción) y **error** (mensaje claro + reintentar).

## Accesibilidad y responsive

- Mobile-first; probar a 375 px y 1280 px.
- Áreas táctiles de mínimo 44 × 44 px.
- Contraste AA: el dorado sobre negro pasa; no pongas texto dorado sobre `bg-surface-raised` en tamaños menores a 14 px.
- Foco visible (ya definido globalmente con el anillo morado).

## Tono de los textos

Español de México, cercano, tuteando: "Agrega a tu carrito", "¿Tienes una idea? Hagámosla realidad". Nada de lorem ipsum: si falta un texto real, escribe uno plausible y márcalo `TODO(copy)`.

## Íconos

`lucide-svelte`, tamaño 18–20 px, `stroke-width={1.75}`.
