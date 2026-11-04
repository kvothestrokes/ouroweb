# B2B Landing (`/empresas`) & Admin Prospecting (`/admin/empresas`) Upgrade

Objective: upgrade `/empresas` and `/admin/empresas` to provide a deeply personalized B2B experience with a giant company name in the Hero, admin logo preloading and a saved prospects list in `/admin/empresas`, top-of-page mockups when entering via a personalized link with a logo, a redesigned multi-surface "Visualiza tu identidad" panel, an early CTA button to "Muestras reales de taller / Trabajos entregados y acabados", a sticky visual section submenu (`B2bSectionNav`), and reordered landing sections with "Paquetes corporativos" in penultimate position. Status: **done**. Delivery: `ask-on-risk`. Test runner: Vitest (`npm run test`), `npm run check`, `npm run lint`.

## Specs

- S1 — User: "landing debe tener en grande el nombre de la empresa y en general hacer que la experiencia sea más personalizada".
- S2 — User: "opcion de precargar el logo desde el lado del admin para que la empresa al entrar pueda visualizar los mockups reodenar el panel de Visualiza tu identidad".
- S3 — User: "cuando es un enlace personalizado lo primero que debe ver hasta arriba son sus mockups si los tiene (agregar en admin/empresas una lista )".
- S4 — User: "los paquetes corporativos deben estar en penultimo lugar".
- S5 — User: "al principo debe haber un boton que lleve a la parte de Muestras reales de taller Trabajos entregados y acabados".
- S6 — User: "mantener un orden general mejor entre cada parte de la landing, y quiza un submenu o una manera para navegar entre las partes de forma mas rapida y sencilla, debe ser visual y generar confianza".

## Tasks

| ID  | Specs      | Route  | Status | Description                                                                                                                                                                                                  |
| --- | ---------- | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1  | S2, S3     | inline | done   | Migration `supabase/migrations/20261104050000_b2b_prospects_y_mockups.sql` (`b2b_prospects` table + RLS policies) and `src/lib/types/database.ts` types.                                                     |
| T2  | S1, S2, S3 | inline | done   | Extend `src/lib/domain/b2b.ts` + `src/lib/domain/b2b.spec.ts` with `B2bProspect`, `b2bProspectFromForm`, `buildProspectingLink` (`?p=<slug>` support), and prospect helpers.                                 |
| T3  | S2, S3     | inline | done   | Add transparency-preserving `prepareLogoPhoto` in `product-photos.ts`, `b2bProspectLogo` in `store-images.ts`, `/img/b2b/prospect/[id]/+server.ts`, and prospect loaders/actions in `server/b2b.ts`.         |
| T4  | S2, S3     | inline | done   | Upgrade `/admin/empresas` (`+page.server.ts`, `+page.svelte`): saved prospects list, create/edit prospect with logo preloading, live dark/light logo preview, and 1-click link/WhatsApp actions.             |
| T5  | S1–S6      | inline | done   | Redesign `/empresas` (`+page.server.ts`, `+page.svelte`): sticky visual submenu, giant company name Hero, early `#portafolio` CTA, top mockups for custom links, multi-surface mockup studio, section order. |
| T6  | S1–S6      | inline | done   | Update `docs/guia-admin-empresas-b2b.md` and verify with Vitest, `npm run check`, and `npm run lint`.                                                                                                        |

## Log

- L1 (2026-11-04, user): Requested detailed plan for B2B `/empresas` and `/admin/empresas` improvements (S1–S6).
- L2 (2026-11-04, user): Approved `implementation_plan.md`.
- L3 (2026-11-04, agent): Implemented T1–T6 and verified (`b2b.spec.ts`, `svelte-check`, and `lint` green).
