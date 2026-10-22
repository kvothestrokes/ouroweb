# CLAUDE.md — Ouroboros E-commerce

Tienda en línea de **Ouroboros**: playeras y sudaderas con diseños de anime / cultura pop y personalizadas, sublimados, grabado láser, velas, productos Cricut e impresiones 3D. Los pedidos se confirman por WhatsApp con un folio; no hay pago en línea.

## Fuente de verdad

- **Especificación completa:** `docs/OUROBOROS_ECOMMERCE.md` (decisiones, flujos, modelo de datos, roadmap y checklist).
- Antes de cualquier tarea, lee la sección del spec que aplica. No re-decidas algo que ya está en "Decisiones tomadas" (sección 2); si algo choca con el spec, pregunta antes de cambiarlo.
- Si una decisión nueva se toma durante el trabajo, agrégala a la sección 2 del spec.

## Estado actual

- Fase actual: **Fase 3 — Tienda: catálogo**. Fase 2 completa.
- El progreso vive en la sección 12 (checklist) y 14 (registro) del spec.

## Stack

- **SvelteKit + Svelte 5** (solo runes: `$props`, `$state`, `$derived`, `$effect`; snippets en lugar de slots; `onclick` en lugar de `on:click`).
- **TypeScript** en modo estricto.
- **Tailwind CSS v4** + **shadcn-svelte**. Tema oscuro único; tokens en `src/app.css` (plantilla en `setup/app.css`).
- **Supabase**: Postgres, Auth (un solo admin), RLS, Realtime. Cliente con `@supabase/ssr`.
- **ImageKit**: almacenamiento y transformación de imágenes. SDK y llave privada **solo en servidor**.
- **Deploy:** Vercel (`@sveltejs/adapter-vercel`).
- Idioma de la interfaz: **español de México**, tuteando al cliente. Moneda MXN con `Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })`.

## Comandos

```bash
npm run dev          # servidor local (http://localhost:5173)
npm run check        # svelte-check + tipos
npm run lint         # eslint + prettier --check
npm run format       # prettier --write
npm run test         # vitest
npx supabase migration new <nombre>   # nueva migración
npx supabase db push                  # aplicar migraciones (pide confirmación)
```

Antes de dar una tarea por terminada: `npm run check`, `npm run lint` y `npm run test` deben pasar.

## Estructura de carpetas (objetivo)

```
src/
  app.css                     # tokens del tema (desde setup/app.css)
  lib/
    components/ui/            # shadcn-svelte (generado)
    components/store/         # tienda: ProductCard, ColorSwatches, CategorySubnav, CategoryHero…
    components/admin/         # panel: OrderTable, OrderStatusBadge, PaymentForm…
    domain/                   # lógica pura y testeada: pricing.ts, order-status.ts, whatsapp.ts, folio.ts, phone.ts
    server/                   # SOLO servidor: supabase-admin.ts, imagekit.ts, orders.ts
    stores/                   # carrito y favoritos (estado en navegador)
    types/                    # tipos compartidos y tipos generados de Supabase
  routes/
    (store)/                  # tienda pública: /, /c/[categoria], /p/[producto], /colecciones/[slug], /carrito, /checkout, /encargos, /seguimiento
    admin/                    # panel protegido
    api/                      # endpoints: pedidos, encargos, seguimiento, firmas de subida
supabase/
  migrations/                 # SQL versionado
  seed.sql
```

## Reglas no negociables

1. **Precios y totales se calculan en el servidor.** Nunca confíes en los precios que manda el carrito; recalcula con `src/lib/domain/pricing.ts` usando datos de la BD.
2. **Secretos solo en servidor:** variables declaradas en `src/env.ts` e importadas desde `$app/env/private` (SvelteKit 3; `$env/*` está deprecado) y archivos `*.server.ts` o `src/lib/server/**`. Nada con `PRIVATE`/`SECRET` puede importarse desde componentes.
3. **RLS siempre activo** en todas las tablas. El público solo lee catálogo activo, colecciones, galería y reseñas aprobadas. Los pedidos se crean solo desde endpoints del servidor.
4. **Los diseños originales nunca se exponen.** Las imágenes de producto se sirven como mockup compuesto, con marca de agua y URL firmada. Ver skill `ouroboros-imagekit`.
5. **URLs firmadas con expiración fija por periodo** (no "ahora + N segundos") para no romper la caché.
6. **Snapshot de precios** en `order_items`: cambiar el catálogo no altera pedidos existentes.
7. **Sin colores hardcodeados:** usa los tokens del tema. Ver skill `ouroboros-ui`.
8. **Mobile-first** y accesible: contraste AA, foco visible, áreas táctiles de 44 px, `alt` en imágenes.
9. **Migraciones:** una migración aplicada nunca se edita; se crea otra nueva.
10. **No inventes datos del negocio** (datos bancarios, dirección, medidas, precios). Usa placeholders con `TODO(negocio):` y anótalo en "Pendientes por definir" del spec.

## Dominio clave (resumen)

- **Folio:** `OUR-AAMM-NNNN`, generado por función atómica en Postgres; el consecutivo reinicia cada mes.
- **Estados:** Pendiente → Esperando anticipo → Confirmado → En producción → Listo → (Enviado | Listo para recoger) → Entregado. Cancelado desde los tres primeros.
- **Totales:** subtotal (base + recargo de talla) − mayoreo − cupón + personalización (cotizada) + envío (cotizado). Anticipo manual por pedido, sugerido 50%.
- **WhatsApp del negocio:** `PUBLIC_WHATSAPP_NUMBER` (529612423984). Enlaces `https://wa.me/<numero>?text=<encodeURIComponent(mensaje)>`.
- **Seguimiento:** folio + últimos 4 dígitos del WhatsApp del cliente.

Detalle completo en la skill `ouroboros-pedidos` y en el spec.

## Svelte MCP

Este proyecto tiene configurado el servidor MCP oficial de Svelte (`.mcp.json`):

- Para dudas de Svelte 5 o SvelteKit, consulta primero su documentación con las herramientas del MCP (listar secciones y traer las relevantes).
- Pasa cada componente `.svelte` nuevo o modificado por la herramienta de autofix/análisis antes de darlo por terminado, y corrige lo que reporte.

## Supabase MCP

Configurado en **solo lectura** y limitado al proyecto (`SUPABASE_PROJECT_REF`). Úsalo para inspeccionar el esquema y depurar consultas. Los cambios de esquema van siempre como archivos en `supabase/migrations/`. Nunca lo conectes a datos de producción.

## Flujo de trabajo por tarea

1. Identifica la fase y el ítem del checklist (spec, sección 12).
2. Lee las secciones del spec relacionadas y la skill que aplique.
3. Propón un plan corto (qué archivos y por qué) si la tarea toca más de 3 archivos.
4. Implementa en pasos pequeños. La lógica de dominio va en `src/lib/domain/` con pruebas en Vitest.
5. Verifica: `check`, `lint`, `test` y, si es UI, revisa en el navegador en móvil y escritorio.
6. Actualiza el progreso con la skill `progreso` (casilla del checklist, estado de la fase y registro).
7. Commit con Conventional Commits en español: `feat(catalogo): swatches de color en ProductCard`.

## Skills y agentes del proyecto

| Nombre               | Tipo   | Cuándo                                                                   |
| -------------------- | ------ | ------------------------------------------------------------------------ |
| `ouroboros-ui`       | skill  | Cualquier pantalla, componente o estilo                                  |
| `ouroboros-imagekit` | skill  | Subidas, mockups, URLs firmadas, caché, protección de imágenes           |
| `ouroboros-pedidos`  | skill  | Carrito, checkout, folio, estados, totales, pagos, WhatsApp, seguimiento |
| `fase`               | skill  | Arrancar o continuar una fase del roadmap                                |
| `progreso`           | skill  | Marcar avance en el spec al terminar algo                                |
| `revisor-ui`         | agente | Revisar UI contra el sistema de diseño antes de cerrar una tarea visual  |
| `revisor-seguridad`  | agente | Revisar endpoints, RLS, secretos e imágenes antes de cerrar una fase     |
