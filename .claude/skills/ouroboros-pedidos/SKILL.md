---
name: ouroboros-pedidos
description: Lógica de pedidos de Ouroboros — carrito, checkout, encargos especiales, folio OUR-AAMM-NNNN, estados y transiciones, cálculo de totales (recargo por talla, mayoreo, cupones, envío y personalización cotizados), anticipos y pagos, plantillas y enlaces de WhatsApp, y seguimiento por folio. Úsala al trabajar en cualquier parte del flujo de compra o del módulo de pedidos del admin.
---

# Ouroboros — pedidos

La lógica pura vive en `src/lib/domain/` y se prueba con Vitest. Los endpoints en `src/routes/api/` la usan; los componentes no recalculan nada importante.

## Folio

Función atómica en Postgres (migración de Fase 1):

```sql
create table public.folio_counters (
  periodo text primary key,
  ultimo  integer not null default 0
);

create or replace function public.next_folio()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  p text := to_char(now() at time zone 'America/Mexico_City', 'YYMM');
  n integer;
begin
  insert into folio_counters (periodo, ultimo) values (p, 1)
  on conflict (periodo) do update set ultimo = folio_counters.ultimo + 1
  returning ultimo into n;
  return 'OUR-' || p || '-' || lpad(n::text, 4, '0');
end;
$$;

revoke all on function public.next_folio() from public, anon, authenticated;
```

Solo el servidor (llave secreta) la ejecuta, dentro de la misma operación que inserta el pedido.

## Estados (`src/lib/domain/order-status.ts`)

```ts
export const ESTADOS = [
	'pendiente',
	'esperando_anticipo',
	'confirmado',
	'en_produccion',
	'listo',
	'enviado',
	'listo_para_recoger',
	'entregado',
	'cancelado'
] as const;

export const TRANSICIONES: Record<Estado, Estado[]> = {
	pendiente: ['esperando_anticipo', 'cancelado'],
	esperando_anticipo: ['confirmado', 'cancelado'],
	confirmado: ['en_produccion', 'cancelado'],
	en_produccion: ['listo'],
	listo: ['enviado', 'listo_para_recoger'], // según metodo_entrega
	enviado: ['entregado'],
	listo_para_recoger: ['entregado'],
	entregado: [],
	cancelado: []
};
```

- Cada cambio inserta una fila en `order_events`.
- `listo → enviado` solo si la entrega es domicilio o paquetería; `listo → listo_para_recoger` solo si es recoger.
- Pasar a `confirmado` requiere un pago registrado de tipo anticipo.
- Etiquetas visibles: Pendiente, Esperando anticipo, Confirmado, En producción, Listo, Enviado, Listo para recoger, Entregado, Cancelado.

## Totales (`src/lib/domain/pricing.ts`)

```
linea           = (precio_base + recargo_talla) × cantidad
subtotal        = Σ lineas
desc_mayoreo    = mejor escala aplicable (por producto; si no hay, por categoría)
desc_cupon      = sobre (subtotal − desc_mayoreo); valida vigencia, mínimo y usos
personalizacion = capturado por admin (null = "por cotizar")
envio           = capturado por admin (null = "por cotizar"; 0 si recoge)
total           = subtotal − desc_mayoreo − desc_cupon + (personalizacion ?? 0) + (envio ?? 0)
pagado          = Σ payments.monto
saldo           = total − pagado
anticipo_sugerido = redondear(total × 0.5) a pesos enteros
```

- Trabaja en **centavos (enteros)** para evitar errores de punto flotante.
- `total_es_final` = no hay ningún campo "por cotizar" pendiente. El cliente ve "Total estimado" hasta entonces.
- Prueba todos los casos: tallas grandes, escalas de mayoreo en el límite, cupón vencido, cupón mayor al subtotal (tope en 0), envío 0 al recoger.

## Checkout (endpoint `POST /api/pedidos`)

1. Valida con Zod: nombre, WhatsApp (10 dígitos), método de entrega, dirección condicional, notas, cupón, items `{ productId, garmentBaseId, talla, cantidad, personalizacion? }`.
2. Lee productos y precios **desde la BD**; rechaza inactivos, colores o tallas no válidos y stock insuficiente (modo stock).
3. Calcula totales con `pricing.ts`, obtiene folio con `next_folio()`, inserta `orders` + `order_items` (snapshot) + evento inicial en una transacción (función RPC en Postgres).
4. Responde `{ folio, whatsappUrl, seguimientoUrl }`.
5. Limita la tasa de pedidos por IP para evitar spam.

Los encargos usan `POST /api/encargos` con el mismo patrón y `tipo = 'encargo'`.

## Teléfonos (`src/lib/domain/phone.ts`)

- Captura: 10 dígitos nacionales. Guarda normalizado como `52XXXXXXXXXX`.
- Enlace al cliente: `https://wa.me/52XXXXXXXXXX?text=...`.

## WhatsApp (`src/lib/domain/whatsapp.ts`)

- `renderPlantilla(cuerpo, variables)` reemplaza `{{variable}}`; las variables sin valor quedan vacías, nunca como `{{...}}` literal.
- `lineaResumen(item)` → `• 2× Playera Akatsuki · Negro · M — $560`; si hay personalización agrega `  ✏️ Personalización: <texto> (por cotizar)`.
- `enlaceWhatsApp(numero, mensaje)` → `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`.
- Las plantillas viven en la tabla `wa_templates` (claves y ejemplos en el spec, sección 8) y se siembran en `seed.sql`.
- Dinero dentro de mensajes con el mismo formateador MXN.

## Pagos

- `payments.tipo`: `anticipo` | `abono` | `liquidacion`. Monto > 0 y ≤ saldo.
- El comprobante es opcional; se sube a `/ouroboros/orders/{folio}/`.
- El dashboard cuenta "anticipos pendientes" = pedidos en `esperando_anticipo`.

## Seguimiento (`POST /api/seguimiento`)

- Entrada: folio + últimos 4 dígitos del WhatsApp. Compara en el servidor; responde lo mismo para "no existe" y "no coincide".
- Devuelve: estado, línea de tiempo, items, total, pagado, saldo, guía y si puede dejar reseña (`entregado` y sin reseña previa).
- Limita intentos por IP.
