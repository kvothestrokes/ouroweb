# Fase 2 — Admin: catálogo

Objective: admin panel for the catalog (spec section 12, Fase 2) plus the Phase 1 data the user just defined. Branch: `feat/fase-2-admin-catalogo`, stacked on `feat/fase-1-base-de-datos` (not merged to `main` yet). Delivery: `ask-on-risk`. Test runner: Vitest (`npm run test`), `npm run db:smoke` for the database.

## Specs

- S1 — "Login de admin y layout del panel".
- S2 — "CRUD de categorías (con categoría estrella) y colecciones".
- S3 — "Prendas base con editor de área de impresión". User: "ya meti todas las bases de las playeras aqui @../ouroboros-web/src/public/ vamos a utiliza imagenes locales y cada imagen tiene en el nombre su color".
- S4 — "Subida de diseños con vista previa en todos los colores".
- S5 — "CRUD de productos (mockup y foto real) con colores, stock / bajo pedido".
- S6 — "Recargos por talla y guía de tallas por tipo de prenda". User: "las tallas son CH M G XG XXG".
- S7 — User: "los precios vamos a dejarlos en una config global precios normales, descuento, mayoreo, etc por lo pronto que sean 170 mxn normales 150 mayoreo".

Assumptions (marked, to confirm): S6 sizes also apply to Sudadera; S7 prices apply to Playera (Sudadera price left `TODO(negocio)`); the minimum quantity for the mayoreo price is unknown (`TODO(negocio)`); "descuento" is not defined yet, so it gets no column.

## Tasks

| ID  | Specs      | Route  | Status  | Evidence                                                                                     |
| --- | ---------- | ------ | ------- | -------------------------------------------------------------------------------------------- |
| T0  | S3, S6, S7 | inline | done    | RED 3 fails → pushed `20261022090428_precios_y_tallas`; db:smoke 45/45                       |
| T1  | S1         | inline | done    | c5487a9 + fix 47d6fb6; tests 16/16; prod build CSRF 403, HttpOnly; security review B1 closed |
| T2  | S2         | inline | pending |                                                                                              |
| T3  | S3         | inline | done    | migration fc84a34; tests 39/39; browser: 19 registered, drag + save to all verified in DB    |
| T4  | S4         | inline | pending | depends on T3 decision                                                                       |
| T5  | S5, S7     | inline | pending |                                                                                              |
| T6  | S6, S7     | inline | pending |                                                                                              |

Route evidence: sequential units sharing `hooks.server.ts`, the admin layout and the schema; no Writer trigger reason. T0 and T1 are high risk (persisted schema; auth guard) → independent verifier.

## Log

- L1 (2026-10-22, user): "arranquemos la fase 2 y dime paso a paso como resolver los gaps que quedaron de la fase 1"
- L2 (2026-10-22, user): "ya meti todas las bases de las playeras aqui @../ouroboros-web/src/public/ vamos a utiliza imagenes locales y cada imagen tiene en el nombre su color y se ven asi [imagen] las tallas son CH M G XG XXG los precios vamos a dejarlos en una config global precios normales, descuento, mayoreo, etc por lo pronto que sean 170 mxn normales 150 mayoreo continua con la fase"
- L3 (2026-10-22): `src/public` is not served by SvelteKit (that is the Astro convention); photos moved to `static/bases/playera/<color>.jpg` (19 colors; the two "(1)" copies were byte-identical duplicates and were removed). `ourologo.webp` moved to `static/brand/` (1080×1072, no alpha channel). The leftover `favicon.svg` was the Astro default icon and was removed.
- L4 (2026-10-22): T1 security review blocked on B1 (percent-encoded `/%61dmin` skipped the raw-pathname guard; reproduced: `POST /%61dmin/logout` reached the handler). Fixed with route-id based `isPanelRequest` (RED 3 → GREEN 9/9), recheck approved. Open advisories: own login rate limit (medium), remote functions must call `locals.getAdmin()` (documented), stolen token valid until expiry (accepted), Sudadera without price must not price as 0 (for `pricing.ts`).
- L5 (2026-10-22, user, on the mockup options): "vamos a buscar la manera de hacerlo con las imagenes locales sin exponerlas facilmente" — bases stay local, moved out of `static/` to `src/lib/server/assets/bases/` (bundled with `?inline`), composition on our server with `sharp`; designs stay in the private ImageKit folder.
- L6 (2026-10-22, user): "continua, el aviso es mi propio aviso" — the notice on the base photos belongs to the business; keep the photos as they are.
- L7 (2026-10-22, user): "continua autorizo que continues siempre no pidas permisos solo continua con las fases siempre al terminar una empieza la siguiente".
