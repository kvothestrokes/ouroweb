# Fase 1 — Base de datos

Objective: schema, RLS, atomic folio, seed data and admin user on the linked Supabase project. Branch: `feat/fase-1-base-de-datos`. Delivery: `single-pr` (user decides push/PR). Test runner: `npm run db:smoke` against the remote project (no Docker locally); `npm run check/lint/test` for the app.

## Specs

- S1 — "Migraciones de todas las tablas" (spec section 10, 24 tables; order states from section 6.4).
- S2 — "Políticas RLS": "Lectura pública solo de catálogo activo, colecciones, galería y reseñas aprobadas." "Pedidos: se crean únicamente desde un endpoint del servidor". "Todo lo demás solo para el admin autenticado."
- S3 — "Función de folio atómico": "función en Postgres que incrementa `folio_counters` de forma atómica y devuelve `OUR-AAMM-NNNN`", "consecutivo reinicia cada mes".
- S4 — "Datos semilla: categorías, tipos de prenda, prendas base, plantillas de WhatsApp, ajustes". Unknown business data uses `TODO(negocio):` (CLAUDE.md rule 10).
- S5 — "Usuario admin" (single admin, email + password with Supabase Auth).

## Tasks

| ID  | Specs | Route  | Status  | Evidence                                      |
| --- | ----- | ------ | ------- | --------------------------------------------- |
| T1  | S1    | inline | done    | pushed; db:smoke 41/41                        |
| T2  | S2    | inline | done    | pushed; db:smoke 41/41                        |
| T3  | S3    | inline | done    | pushed; db:smoke 41/41                        |
| T4  | S4    | inline | partial | garment_bases blocked by TODO(negocio) photos |
| T5  | S5    | inline | pending |                                               |

Route evidence: one understood schema change written sequentially; no Writer trigger reason (no parallel units, no context backstop). High risk (items 1 and 2: persisted schema, RLS) → independent verifier before closing.

## Log

- L1 (2026-10-22, user): "ya deployé a vercel y funciona bien avancemos con la siguiente fase"
- L2 (2026-10-22, user, on Docker vs remote): "directo" — migrations are applied straight to the linked remote project `wgejdiewrysbuduahptu` (still empty).
- L3 (2026-10-22): pre-push security review (revisor-seguridad): 0 blockers; applied advisories 1, 2, 3, 6, 7, 9 and part of 10 before push. Pushed 3 migrations + seed; `npm run db:smoke` 41/41 passing twice. Next: T5 admin user (needs email from user).
