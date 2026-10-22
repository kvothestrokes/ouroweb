---
name: ouroboros-imagekit
description: Cómo maneja Ouroboros las imágenes con ImageKit — estructura de carpetas, mockups automáticos (diseño sobre prenda base con overlays), marca de agua, URLs firmadas con expiración fija, caché y protección contra descargas, y subidas desde el admin o del cliente. Úsala al tocar cualquier código que suba, genere o muestre imágenes.
---

# Ouroboros — imágenes con ImageKit

## Principios

1. La llave privada y la firma de URLs viven solo en `src/lib/server/imagekit.ts`.
2. El PNG original de un diseño **nunca** llega al navegador: solo el mockup compuesto, reducido y con marca de agua.
3. Las URLs firmadas usan **expiración fija por periodo** para que la caché funcione.
4. Las URLs se generan en `load` del servidor y se pasan ya listas al componente.

## Carpetas

```
/ouroboros/bases      prendas base lisas por tipo y color (lienzo estándar, ej. 2000×2000 px)
/ouroboros/designs    diseños PNG transparentes (PRIVADOS)
/ouroboros/products   fotos reales (tazas, termos, velas, 3D)
/ouroboros/brand      logo, marca de agua (PNG ya semitransparente), banners
/ouroboros/orders     referencias de clientes y comprobantes (PRIVADOS)
/ouroboros/gallery    galería y fotos de reseñas
```

## Mockup automático

Datos (ver spec, sección 10): `garment_bases.area_impresion = { x, y, ancho }` en px del lienzo de la prenda base, `garment_bases.es_clara` y `designs.path_prenda_oscura | path_prenda_clara`.

Composición (sintaxis de capas de ImageKit; las `/` de la ruta de la capa se escriben como `@@`):

```
{endpoint}/ouroboros/bases/playera-negra.jpg
  ?tr=l-image,i-ouroboros@@designs@@akatsuki-oscura.png,w-{ancho},lx-{x},ly-{y},l-end
      :l-image,i-ouroboros@@brand@@marca-agua.png,w-{anchoMarca},lx-{xMarca},ly-{yMarca},l-end
      :w-{anchoSalida},q-80,f-auto
```

- Elige `path_prenda_clara` cuando `es_clara` es verdadero y existe; si no, `path_prenda_oscura`.
- `anchoSalida`: 400 (card), 800 (producto), 1200 máximo (zoom). Genera `srcset` con esos tamaños.
- Placeholder: misma URL con `w-24,q-20,bl-10`.
- Productos con `tipo_imagen = 'foto'` usan `product_images` y solo agregan marca de agua y redimensión.

### Resultado del spike (Fase 0, 2026-10-22)

Validado con `mockupUrl()` de `src/lib/server/imagekit.ts` (no armes la URL a mano). URL real generada por el SDK:

```
{endpoint}/ouroboros/bases/<base>.png
  ?tr=l-image,i-ouroboros@@designs@@<diseño>.png,lx-{x},ly-{y},w-{ancho},l-end
     :l-image,i-ouroboros@@brand@@<marca>.png,lfo-bottom_right,w-bw_div_4,l-end
     :w-{anchoSalida},q-80,f-auto
  &ik-t={expiracionFija}&ik-s={firma}
```

- Un diseño subido con `isPrivateFile: true` **sí funciona como capa** dentro de una URL firmada (200).
- El mismo diseño pedido directo **sin firma** devuelve 403; con firma devuelve 200, así que la URL firmada del diseño suelto nunca debe salir del servidor.
- Expiración fija: `ik-t` cae en múltiplo exacto de 86400. La primera carga del mockup es `Miss from cloudfront` y la segunda `Hit from cloudfront`, con `cache-control: public, max-age=31536000`.
- Las rutas con acentos (`%C3%A1`) se firman bien, aunque en el admin conviene normalizar el nombre del archivo al subirlo.
- `lx`/`ly`/`w` del área de impresión están en px de **la imagen base real**: si la base no mide 2000×2000, el área debe calcularse sobre su tamaño. Si el área se sale del lienzo, el diseño se corta.
- Un diseño de tinta oscura sobre prenda oscura casi no se ve; para eso existen `path_prenda_clara` / `path_prenda_oscura`.

## URLs firmadas con expiración fija

El SDK suele calcular la expiración como "ahora + N segundos", lo que cambia la URL en cada render y rompe la caché. En su lugar:

```ts
// src/lib/server/imagekit.ts (esquema)
const PERIODO = 60 * 60 * 24; // 24 h
function expiracionFija(ahora = Date.now() / 1000) {
	// fin del periodo actual + margen, para que la URL sea idéntica durante todo el día
	return Math.floor(ahora / PERIODO) * PERIODO + PERIODO * 2;
}
// firma = HMAC-SHA1(IMAGEKIT_PRIVATE_KEY, urlSinEndpoint + expiracion) → parámetros ik-t e ik-s
```

Verifica el algoritmo de firma contra la documentación vigente de ImageKit en el spike y agrega una prueba que compare con una URL firmada por el SDK oficial usando la misma expiración.

## Caché

- CDN de ImageKit + `Cache-Control` largo en las imágenes (configurable en el dashboard).
- Páginas de catálogo: `setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400' })` en el `load` del servidor.
- Nunca agregues parámetros aleatorios (`?v=Date.now()`) a las URLs de imagen.
- Al reemplazar un diseño en el admin, sube con nombre nuevo (ej. sufijo de versión) en lugar de sobrescribir.

## Protección en la interfaz (complemento)

- Clase `image-guard`, `draggable="false"` y `oncontextmenu={(e) => e.preventDefault()}` en el contenedor.
- Capa transparente absoluta encima de la imagen en las cards y la galería.
- No expongas rutas de `/designs` en el HTML, JSON de `load` ni atributos `data-*`.

## Subidas

- **Admin:** el servidor genera parámetros de autenticación de subida (token, expire, signature) en `/api/admin/imagekit-auth`, protegido por sesión de admin; el navegador sube directo a ImageKit a la carpeta indicada.
- **Clientes** (referencias de encargos, personalización, fotos de reseñas): mismo mecanismo con un endpoint público limitado: solo imágenes, máx. 5 MB, máx. 5 archivos, carpeta fija `/orders` o `/gallery/pending`, y nombre aleatorio.
- Guarda en BD solo la **ruta** (`filePath`), nunca la URL completa.
