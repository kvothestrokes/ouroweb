-- Ouroboros: seed data (spec sections 4.1, 8 and 10). Idempotent: safe to run again.
-- Business data that is not defined yet is left empty with a TODO(negocio) note
-- (CLAUDE.md rule 10); the admin fills it from the panel.

-- Settings ------------------------------------------------------------------
-- TODO(negocio): datos_bancarios, direccion_taller and horarios (spec section 13).
insert into public.settings (id, whatsapp_negocio, anticipo_sugerido_pct)
values (true, '529612423984', 50)
on conflict (id) do nothing;

-- Categories (spec section 4.1) -----------------------------------------------
insert into public.categories (slug, nombre, orden) values
  ('ropa', 'Ropa', 1),
  ('sublimacion', 'Sublimación', 2),
  ('grabado-laser', 'Grabado láser', 3),
  ('cricut', 'Cricut', 4),
  ('impresion-3d', 'Impresión 3D', 5),
  ('velas', 'Velas', 6)
on conflict (slug) do nothing;

insert into public.categories (slug, nombre, parent_id, es_estrella, orden)
select v.slug, v.nombre, p.id, v.es_estrella, v.orden
from (values
  ('ropa', 'playeras-con-diseno', 'Playeras con diseño', true, 1),
  ('ropa', 'sudaderas-con-diseno', 'Sudaderas con diseño', false, 2),
  ('ropa', 'playeras-personalizadas', 'Playeras personalizadas', false, 3),
  ('ropa', 'sudaderas-personalizadas', 'Sudaderas personalizadas', false, 4),
  ('sublimacion', 'tazas', 'Tazas', true, 1),
  ('sublimacion', 'playmats', 'Playmats', false, 2),
  ('sublimacion', 'mousepads', 'Mousepads', false, 3),
  ('sublimacion', 'otros-sublimados', 'Otros sublimados', false, 4),
  ('grabado-laser', 'termos', 'Termos', true, 1),
  ('grabado-laser', 'otros-grabados', 'Otros grabados', false, 2),
  ('cricut', 'stickers', 'Stickers', true, 1),
  ('cricut', 'vinil-de-corte', 'Vinil de corte', false, 2),
  ('impresion-3d', 'impresiones-3d', 'Impresiones 3D', true, 1),
  ('velas', 'velas-artesanales', 'Velas', true, 1)
) as v (parent_slug, slug, nombre, es_estrella, orden)
join public.categories p on p.slug = v.parent_slug
on conflict (slug) do nothing;

-- Garment types ---------------------------------------------------------------
-- Prices in cents (migration 20261022090428). TODO(negocio): Sudadera prices, minimum
-- pieces for mayoreo, recargos_talla and guia_tallas measurements (spec section 13).
insert into public.garment_types (nombre, tallas, precio_normal, precio_mayoreo) values
  ('Playera', array['CH', 'M', 'G', 'XG', 'XXG'], 17000, 15000),
  ('Sudadera', array['CH', 'M', 'G', 'XG', 'XXG'], null, null)
on conflict (nombre) do nothing;

-- Garment bases ---------------------------------------------------------------
-- TODO(negocio): plain garment photos per color (spec section 13). Each base needs its
-- ImageKit photo and its print area in pixels of that photo, so they are created from
-- the admin panel (Phase 2, visual print-area editor) once the photos exist.

-- Custom request types --------------------------------------------------------
-- TODO(negocio): request types and their "desde $X" price (spec section 13).

-- WhatsApp templates (spec section 8) ------------------------------------------
insert into public.wa_templates (clave, nombre, cuerpo) values
  ('pedido_nuevo', 'Pedido nuevo (cliente → negocio)',
$t$¡Hola, Ouroboros! 🐍✨
Acabo de hacer mi pedido *{{folio}}*

👤 {{nombre}}
📦 Entrega: {{metodo_entrega}}

{{resumen}}

Subtotal: {{subtotal}}
Envío y personalización: por cotizar

Quedo pendiente de la cotización final y los datos para el anticipo. ¡Gracias!$t$),
  ('encargo_nuevo', 'Encargo nuevo (cliente → negocio)',
$t$¡Hola, Ouroboros! 🐍✨
Acabo de enviar mi encargo especial *{{folio}}*

👤 {{nombre}}
📦 Entrega: {{metodo_entrega}}

{{resumen}}

Quedo pendiente de la cotización. ¡Gracias!$t$),
  ('cotizacion_anticipo', 'Cotización y anticipo',
$t$¡Hola, {{nombre}}! 🐍 Gracias por tu pedido *{{folio}}*

Total: {{total}} (incluye envío: {{envio}})
Para iniciar la producción necesitamos un anticipo de *{{anticipo}}*.

{{datos_bancarios}}

Mándanos tu comprobante por aquí y lo ponemos en marcha 🎨
Sigue tu pedido aquí: {{link_seguimiento}}$t$),
  ('anticipo_recibido', 'Anticipo recibido',
$t$¡Hola, {{nombre}}! 🐍 Recibimos tu anticipo de {{pagado}} para el pedido *{{folio}}*.

Tu pedido ya está confirmado. Saldo pendiente: {{saldo}}.
Sigue tu pedido aquí: {{link_seguimiento}}$t$),
  ('en_produccion', 'En producción',
$t$¡Hola, {{nombre}}! 🎨 Tu pedido *{{folio}}* ya está en producción.

Te avisamos en cuanto esté listo.
Sigue tu pedido aquí: {{link_seguimiento}}$t$),
  ('listo_recoger', 'Listo para recoger',
$t$¡Hola, {{nombre}}! 🐍 Tu pedido *{{folio}}* está listo para recoger.

📍 {{direccion_taller}}
Saldo pendiente: {{saldo}}

¡Te esperamos!$t$),
  ('enviado', 'Enviado',
$t$¡Hola, {{nombre}}! 📦 Tu pedido *{{folio}}* ya va en camino.

Guía: {{guia}}
Sigue tu pedido aquí: {{link_seguimiento}}$t$),
  ('entregado_resena', 'Entregado y reseña',
$t$¡Hola, {{nombre}}! 🐍✨ Tu pedido *{{folio}}* fue entregado. ¡Gracias por tu compra!

Nos encantaría saber qué te pareció. Déjanos tu reseña con foto aquí: {{link_seguimiento}}$t$),
  ('cancelado', 'Cancelado',
$t$Hola, {{nombre}}. Tu pedido *{{folio}}* fue cancelado.

Si tienes dudas, escríbenos por aquí y con gusto te ayudamos.$t$)
on conflict (clave) do nothing;
