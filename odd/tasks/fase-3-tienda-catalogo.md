# Fase 3 — Tienda: catálogo

Objective: public store catalog (spec section 12, Fase 3). Branch: `feat/fase-3-tienda-catalogo`. Delivery: `ask-on-risk`. Test runner: Vitest (`npm run test`).

## Specs

- S1 — L1 user request: "continua con las siguiente fase del proyecto". Scope: every Fase 3 checklist item in `docs/OUROBOROS_ECOMMERCE.md` section 12 (layout, home, category with star hero, product card with swatches, product page, size guide F5, search and filters F4, collections F8, favorites F9, stock badges F14, image protection in the UI), per spec sections 4.2–4.4.

Assumptions: the customization reference image is requested over WhatsApp until order uploads exist (Fase 4/5); the "Encargos especiales" button opens WhatsApp until `/encargos` exists (Fase 5).

## Tasks

| ID  | Specs | Route  | Status | Evidence                                                                                                                                          |
| --- | ----- | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| T0  | S1    | inline | done   | fd1aae1 public watermarked image endpoints                                                                                                        |
| T1  | S1    | inline | done   | RED 8 + 10 fails → GREEN; 114 tests; check/lint/build pass; browser 375/1280 with temporary demo data: cart line, favorites, stock filter, guide |

Route evidence: one sequential unit sharing the store layout and data module; no Writer trigger reason.

## Log

- L1 (2026-10-22): "continua con las siguiente fase del proyecto"
- L2: security and UI reviewers launched in the background at phase close.
