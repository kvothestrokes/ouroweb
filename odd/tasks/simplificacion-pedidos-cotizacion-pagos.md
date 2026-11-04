# Order Creation, Quoting & Payment Flow Simplification

Objective: Streamline and accelerate the admin order management workflow (`/admin/pedidos/nuevo` and `/admin/pedidos/[id]`) by removing repetitive manual inputs: auto-inferring payment type based on amount and balance, standardizing payment methods into a clean dropdown, making payment dates automatic, defaulting quote price to catalog item sums with inline editability, and pre-filling required deposits to 50% by default. Status: **done**. Delivery: `ask-on-risk`. Test runner: Vitest (`npm run test`), `npm run check`, `npm run lint`.

## Specs

- **S1 — Dynamic Quote Pricing & 50% Default Deposit**:
  - In `/admin/pedidos/nuevo` and `/admin/pedidos/[id]`:
    - Quoted price defaults to the exact unit price or sum of catalog line items.
    - For `encargo`, price pre-populates with the request type's `precio_desde * cantidad` (or reference product price).
    - In both forms, the base price remains directly editable.
    - `anticipo_requerido` automatically defaults to **50% of the total price** (using `suggestedDeposit`), dynamically updating as items or prices change unless the admin explicitly overrides it with a manual value.
- **S2 — Automatic Payment Type Inference (`inferPaymentType`)**:
  - Eliminate manual selection of `tipo` (`anticipo`, `abono`, `liquidacion`):
    - If `monto >= saldo` -> auto-select `liquidacion`.
    - If `pagado === 0` or `pagado < anticipo_requerido` -> auto-select `anticipo`.
    - If `pagado >= anticipo_requerido` and `monto < saldo` -> auto-select `abono`.
  - Applied reactively in Svelte 5 as the operator inputs the amount or clicks quick chips, with manual override capability preserved.
  - In `/admin/pedidos/nuevo`, initial payment type auto-selects `liquidacion` if paying total in full, otherwise `anticipo`.
- **S3 — Standardized Payment Method Dropdown**:
  - Replace unconstrained `<Input>` text fields with a typed `<select>` dropdown using domain constant `PAYMENT_METHODS`:
    - `Transferencia` (default)
    - `Efectivo`
    - `Tarjeta`
    - `Depósito bancario`
    - `OXXO`
    - `Otro` (reveals a short custom text input if selected).
  - Applied to both `/admin/pedidos/[id]` and `/admin/pedidos/nuevo`.
- **S4 — Automatic Payment Date**:
  - Make payment date automatic (`now()` / `mexicoToday()`) without cluttering the primary form grid.
  - Collapse date selection behind an unobtrusive "Cambiar fecha" toggle for the rare case of retroactive payment logging.

## Architecture & Key Decisions

1. **Domain-Driven Payment Logic (`src/lib/domain/order-money.ts` & `order-admin.ts`)**:
   - Extract `inferPaymentType({ monto, saldo, pagado, anticipoRequerido }): PaymentType` with unit tests covering edge cases (exact balance, under deposit, partial installments, zero amount).
   - Define standard `PAYMENT_METHODS` array and type in `order-admin.ts`.
2. **Reactive Form Contracts in Svelte 5 (`$derived` / `$effect`)**:
   - Keep forms friction-free: reactive derivation automatically sets defaults, but tracks a `dirty` / `userModified` flag so user manual overrides are never clobbered when adjacent fields change.
3. **Database & Invariant Safety**:
   - Zero breaking changes to Postgres schema: `add_payment`, `admin_create_order`, and `quote_order` already support these fields and enforce financial constraints (`total >= pagado`, `anticipo_requerido <= total`).

## Tasks

| ID  | Specs      | Route  | Status | Description                                                                                                                                                                                            |
| --- | ---------- | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1  | S2, S3     | inline | done   | Extend domain in `src/lib/domain/order-money.ts` and `src/lib/domain/order-admin.ts`: add `inferPaymentType()`, `PAYMENT_METHODS`, and corresponding Vitest unit tests in `order-money.spec.ts`.       |
| T2  | S1         | inline | done   | Update `/admin/pedidos/nuevo`: auto-default `anticipo_requerido` to 50% reactively, auto-fill encargo price from type reference, integrate `PAYMENT_METHODS` dropdown, and auto-infer initial payment. |
| T3  | S1, S4     | inline | done   | Update `/admin/pedidos/[id]` (Cotización): ensure base price is clear/modifiable, auto-fill `anticipo_requerido` to 50% by default if unset, and preserve manual edits.                                |
| T4  | S2, S3, S4 | inline | done   | Update `/admin/pedidos/[id]` (Pagos): reactive auto-type selection based on `monto`, replace method input with `PAYMENT_METHODS` dropdown, and make date automatic by default.                         |
| T5  | S1–S4      | inline | done   | Verification: Vitest suite green (41/41 files, 246/246 tests), `svelte-check` 0 errors / 0 warnings, ESLint/Prettier clean.                                                                          |

## Log

- L1 (2026-11-04, user): Request to streamline order creation, quoting, and payment workflow. S1–S4 scoped.
- L2 (2026-11-04, user): "dale" — Implemented T1–T5 and verified (tests, svelte-check, lint passing).
