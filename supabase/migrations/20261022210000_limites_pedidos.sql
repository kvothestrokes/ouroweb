-- Ouroboros: create_order hardening (Fase 4 security review).
-- Serializes order creation with a transaction-scoped advisory lock and adds store-wide
-- caps on pending orders, so random phone numbers cannot exhaust the monthly folios.
-- A failed insert never spends a folio: the counter update rolls back with it.

create or replace function public.create_order(
  p_order jsonb,
  p_items jsonb,
  p_fecha timestamptz default now()
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_folio text;
  v_order_id uuid;
  v_subtotal integer;
  v_desc_mayoreo integer;
  v_envio integer;
  v_items_total integer;
  v_recent integer;
  v_recent_day integer;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'order without items' using errcode = '22023';
  end if;

  v_subtotal := (p_order ->> 'subtotal')::integer;
  v_desc_mayoreo := coalesce((p_order ->> 'desc_mayoreo')::integer, 0);
  -- Pickup has no shipping; other methods are quoted later by the admin (null).
  v_envio := case when p_order ->> 'metodo_entrega' = 'recoger' then 0 else null end;

  select coalesce(sum(
    ((item ->> 'precio_unitario')::integer + coalesce((item ->> 'recargo_talla')::integer, 0))
    * (item ->> 'cantidad')::integer
  ), 0)
  into v_items_total
  from jsonb_array_elements(p_items) as item;

  if v_items_total <> v_subtotal then
    raise exception 'subtotal does not match items' using errcode = '22023';
  end if;

  -- One order at a time: makes the counts below exact under concurrency (orders are few).
  perform pg_advisory_xact_lock(hashtext('ouroboros:create_order'));

  -- Spam guard: at most 5 pending orders per WhatsApp number per hour.
  select count(*) into v_recent
  from public.orders
  where cliente_whatsapp = p_order ->> 'cliente_whatsapp'
    and estado = 'pendiente'
    and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'too_many_orders' using errcode = 'P0001';
  end if;

  -- Store-wide caps, so invented numbers cannot burn the 9999 folios of a month:
  -- 60 pending orders per hour and 300 per day (300 x 31 < 9999).
  select count(*) filter (where created_at > now() - interval '1 hour'),
         count(*)
  into v_recent, v_recent_day
  from public.orders
  where estado = 'pendiente'
    and created_at > now() - interval '1 day';
  if v_recent >= 60 or v_recent_day >= 300 then
    raise exception 'store_busy' using errcode = 'P0001';
  end if;

  v_folio := public.next_folio('OUR', p_fecha);

  insert into public.orders (
    folio, tipo, cliente_nombre, cliente_whatsapp, metodo_entrega, direccion, notas_cliente,
    subtotal, desc_mayoreo, envio, total
  ) values (
    v_folio,
    'catalogo',
    p_order ->> 'cliente_nombre',
    p_order ->> 'cliente_whatsapp',
    (p_order ->> 'metodo_entrega')::public.delivery_method,
    case when jsonb_typeof(p_order -> 'direccion') = 'object' then p_order -> 'direccion' end,
    coalesce(p_order ->> 'notas_cliente', ''),
    v_subtotal,
    v_desc_mayoreo,
    v_envio,
    v_subtotal - v_desc_mayoreo + coalesce(v_envio, 0)
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, nombre_snapshot, color, talla, cantidad, precio_unitario,
    recargo_talla, personalizacion_texto
  )
  select
    v_order_id,
    (item ->> 'product_id')::uuid,
    item ->> 'nombre_snapshot',
    item ->> 'color',
    item ->> 'talla',
    (item ->> 'cantidad')::integer,
    (item ->> 'precio_unitario')::integer,
    coalesce((item ->> 'recargo_talla')::integer, 0),
    item ->> 'personalizacion_texto'
  from jsonb_array_elements(p_items) as item;

  insert into public.order_events (order_id, estado, nota)
  values (v_order_id, 'pendiente', 'Pedido creado desde la tienda');

  return v_folio;
end;
$$;
