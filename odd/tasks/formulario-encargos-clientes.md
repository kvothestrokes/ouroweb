# Customer Custom Orders Form Redesign & Size Breakdown

Objective: Redesign the customer-facing special requests form (`/encargos`) to capture structured product types, colors, per-garment size breakdown, an accessible and branded date picker, draft auto-save, live quote preview, enriched WhatsApp templates, and admin visibility. Status: **done**. Delivery: `ask-on-risk`. Test runner: Vitest (`npm run test`), `npm run check`, `npm run lint`.

## Specs

- S1 — Product Type, Color & Size Breakdown: Allow clients to choose a product category/type (e.g. Playera, Sudadera, Gorra, Taza/Termo, etc.), a color swatch, and an interactive size counter grid (`CH`, `M`, `G`, `XL`, `2XL`, etc.) allowing multiple quantities per size (e.g. 2x M, 1x G) when textile, or a simple count when non-textile.
- S2 — Branded Accessible Date Picker: Replace raw `<input type="date">` with an accessible `bits-ui` + `@internationalized/date` calendar popover styled with Ouroboros tokens and quick-select presets (e.g. "Estándar 3-5 días", "1 semana", "2 semanas", or custom date), disabling past dates.
- S3 — Progressive Flow & QoL: Step-by-step or accordion guided flow, live quote summary card, and `localStorage` draft auto-save so users don't lose text or selections on reload.
- S4 — WhatsApp & Admin Visibility: Structured WhatsApp summary for immediate quote handling, and display of `tipo_producto`, `color`, and `desglose_tallas` in `/admin/pedidos/[id]`.
- S5 — Schema & Domain Integrity: Maintain Postgres constraints, atomic orders, and domain validation with unit tests.

## Architecture & Key Decisions

1. **Schema Extension (`custom_requests`)**:
   - Added columns `tipo_producto text`, `color text`, and `desglose_tallas jsonb not null default '[]'::jsonb`.
   - Invariant: `cantidad` matches `sum(item.cantidad)` when `desglose_tallas` has items, preserving total piece counts across reports and quote logic.
   - Updated Postgres RPCs `create_custom_order`, `admin_create_order`, and `admin_update_custom_request`.
2. **Domain Layer (`src/lib/domain/custom-request.ts`)**:
   - Parse and validate `tipo_producto`, `color`, and `desglose_tallas` from form data or JSON.
   - Guarantee `cantidad` derivation and backward compatibility for freeform descriptions.
3. **UI System Integration (`bits-ui` + Tailwind tokens)**:
   - Built `DatePicker.svelte` leveraging `@internationalized/date` and `bits-ui` calendar primitives with quick presets.
   - Reusable `SizeBreakdownPicker.svelte` for fast +/- adjustments per size with total tally.
4. **Resilience & QoL**:
   - `localStorage` draft persistence (`ouroboros:encargo_draft`) automatically saving/restoring user input.
   - Live summary preview card showing current items, sizes, colors, delivery method, and required date.

## Tasks

| ID  | Specs  | Route  | Status | Description                                                                                                                                                                                                                  |
| --- | ------ | ------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | S1, S5 | inline | done   | Migration adding `tipo_producto`, `color`, `desglose_tallas` to `custom_requests` and RPCs `create_custom_order`, `admin_create_order`, `admin_update_custom_request`. Domain schemas and unit tests in `custom-request.ts`. |
| T2  | S2     | inline | done   | Branded accessible `DatePicker.svelte` using `bits-ui` and `@internationalized/date`.                                                                                                                                        |
| T3  | S1, S3 | inline | done   | Redesign `/encargos` with guided steps, color swatches, size counter matrix, live summary, and `localStorage` draft preservation.                                                                                            |
| T4  | S4     | inline | done   | Enriched WhatsApp template in `custom-orders.ts` and admin visualization in `/admin/pedidos/[id]`.                                                                                                                           |
| T5  | S1–S5  | inline | done   | Verification: Vitest unit tests (41/41 files, 243/243 tests pass), `svelte-check` 0 errors / 0 warnings, ESLint and Prettier 100% clean.                                                                                     |

## Log

- L1 (2026-11-04, user): "genera un plan para esto - mejorar el formulario de clientes, agregar tallas, colores, tipo de producto, etc. fecha de entrega que sea un date picker bonito y cualquier mejora de calidad de vida y simplicidad para el flujo en general que puedas proponer o analizar y encontrar".
- L2 (2026-11-04, user): "tallas por cada prenda" — Confirmed multi-size breakdown per item.
- L3 (2026-11-04, user): "dale" — Implemented T1–T5 and verified cleanly.
