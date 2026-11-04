-- Extend custom_requests with structured product type, color, and per-item size breakdown
alter table public.custom_requests
  add column if not exists tipo_producto text,
  add column if not exists color text,
  add column if not exists desglose_tallas jsonb not null default '[]'::jsonb;

comment on column public.custom_requests.tipo_producto is 'Structured product or garment category (e.g. Playera, Sudadera, Termo)';
comment on column public.custom_requests.color is 'Selected color name or shade for the batch';
comment on column public.custom_requests.desglose_tallas is 'JSON array of size breakdown [{ "talla": "M", "cantidad": 2 }, ...]';

-- 1. Storefront create_custom_order
create or replace function public.create_custom_order(
  p_order jsonb,
  p_request jsonb,
  p_fecha timestamptz default now()
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_folio text;
  v_order_id uuid;
  v_envio integer;
begin
  perform public.guard_new_order(p_order ->> 'cliente_whatsapp', 'encargo');

  if p_request ->> 'custom_request_type_id' is not null and not exists (
    select 1 from public.custom_request_types
    where id = (p_request ->> 'custom_request_type_id')::uuid and activo
  ) then
    raise exception 'request_type_unavailable' using errcode = '22023';
  end if;

  v_envio := case when p_order ->> 'metodo_entrega' = 'recoger' then 0 else null end;
  v_folio := public.next_folio('OUR', p_fecha);

  -- The price is quoted later (custom_requests.precio_final, mirrored into subtotal).
  insert into public.orders (
    folio, tipo, cliente_nombre, cliente_whatsapp, metodo_entrega, direccion, notas_cliente,
    subtotal, envio, total
  ) values (
    v_folio,
    'encargo',
    p_order ->> 'cliente_nombre',
    p_order ->> 'cliente_whatsapp',
    (p_order ->> 'metodo_entrega')::public.delivery_method,
    case when jsonb_typeof(p_order -> 'direccion') = 'object' then p_order -> 'direccion' end,
    coalesce(p_order ->> 'notas_cliente', ''),
    0,
    v_envio,
    coalesce(v_envio, 0)
  )
  returning id into v_order_id;

  insert into public.custom_requests (
    order_id, custom_request_type_id, descripcion, cantidad, fecha_deseada,
    tipo_producto, color, desglose_tallas
  ) values (
    v_order_id,
    nullif(p_request ->> 'custom_request_type_id', '')::uuid,
    p_request ->> 'descripcion',
    coalesce((p_request ->> 'cantidad')::integer, 1),
    nullif(p_request ->> 'fecha_deseada', '')::date,
    nullif(trim(p_request ->> 'tipo_producto'), ''),
    nullif(trim(p_request ->> 'color'), ''),
    coalesce(p_request -> 'desglose_tallas', '[]'::jsonb)
  );

  insert into public.order_events (order_id, estado, nota)
  values (v_order_id, 'pendiente', 'Encargo creado desde la tienda');

  return v_folio;
end;
$$;

-- 2. Admin create_order (admin_create_order)
create or replace function public.admin_create_order(
  p_order jsonb,
  p_items jsonb default '[]'::jsonb,
  p_request jsonb default null,
  p_payment jsonb default null,
  p_fecha timestamptz default now()
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_folio text;
  v_order_id uuid;
  v_tipo public.order_type;
  v_estado public.order_status;
  v_metodo public.delivery_method;
  v_direccion jsonb;
  v_subtotal integer := 0;
  v_desc_mayoreo integer;
  v_desc_cupon integer;
  v_personalizacion integer;
  v_envio integer;
  v_anticipo integer;
  v_total integer;
  v_precio_final integer;
  v_pago_tipo public.payment_type;
  v_pago_monto integer;
  v_pago_metodo text;
begin
  perform public.assert_order_admin();

  v_tipo := coalesce((p_order ->> 'tipo')::public.order_type, 'catalogo');
  v_estado := coalesce((p_order ->> 'estado')::public.order_status, 'pendiente');
  v_metodo := (p_order ->> 'metodo_entrega')::public.delivery_method;
  v_direccion := case
    when v_metodo = 'recoger' then null
    when jsonb_typeof(p_order -> 'direccion') = 'object' then p_order -> 'direccion'
    else null
  end;

  if v_metodo <> 'recoger' and v_direccion is null then
    raise exception 'address_required' using errcode = '22023';
  end if;

  if v_estado not in ('pendiente', 'esperando_anticipo', 'confirmado') then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;

  if v_tipo = 'catalogo' then
    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
      raise exception 'order without items' using errcode = '22023';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_items) as item
      where coalesce((item ->> 'cantidad')::integer, 0) <= 0
         or coalesce((item ->> 'precio_unitario')::integer, -1) < 0
         or coalesce((item ->> 'recargo_talla')::integer, 0) < 0
         or length(trim(coalesce(item ->> 'nombre_snapshot', ''))) = 0
    ) then
      raise exception 'invalid_amount' using errcode = '22023';
    end if;

    select coalesce(sum(
      ((item ->> 'precio_unitario')::integer + coalesce((item ->> 'recargo_talla')::integer, 0))
      * (item ->> 'cantidad')::integer
    ), 0)
    into v_subtotal
    from jsonb_array_elements(p_items) as item;
  else
    if jsonb_typeof(p_request) <> 'object'
       or length(trim(coalesce(p_request ->> 'descripcion', ''))) = 0
       or coalesce((p_request ->> 'cantidad')::integer, 1) <= 0 then
      raise exception 'request_not_found' using errcode = '22023';
    end if;
    v_precio_final := (p_request ->> 'precio_final')::integer;
    if coalesce(v_precio_final, 0) < 0 then
      raise exception 'invalid_amount' using errcode = '22023';
    end if;
    v_subtotal := coalesce(v_precio_final, 0);
  end if;

  v_desc_mayoreo := coalesce((p_order ->> 'desc_mayoreo')::integer, 0);
  v_desc_cupon := coalesce((p_order ->> 'desc_cupon')::integer, 0);
  v_personalizacion := (p_order ->> 'personalizacion')::integer;
  v_envio := case when v_metodo = 'recoger' then 0 else (p_order ->> 'envio')::integer end;
  v_anticipo := (p_order ->> 'anticipo_requerido')::integer;

  if v_desc_mayoreo < 0 or v_desc_cupon < 0
     or coalesce(v_personalizacion, 0) < 0 or coalesce(v_envio, 0) < 0
     or coalesce(v_anticipo, 0) < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  if v_desc_mayoreo + v_desc_cupon > v_subtotal then
    raise exception 'discount_above_price' using errcode = '22023';
  end if;

  v_total := v_subtotal - v_desc_mayoreo - v_desc_cupon
    + coalesce(v_personalizacion, 0) + coalesce(v_envio, 0);

  if v_anticipo is not null and v_anticipo > v_total then
    raise exception 'deposit_above_total' using errcode = '22023';
  end if;

  if jsonb_typeof(p_payment) = 'object' then
    v_pago_tipo := (p_payment ->> 'tipo')::public.payment_type;
    v_pago_monto := (p_payment ->> 'monto')::integer;
    v_pago_metodo := coalesce(nullif(trim(p_payment ->> 'metodo'), ''), 'Sin especificar');
    if v_pago_monto is null or v_pago_monto <= 0 then
      raise exception 'invalid_amount' using errcode = '22023';
    end if;
    if v_pago_monto > v_total then
      raise exception 'payment_exceeds_balance' using errcode = '22023';
    end if;
  elsif v_estado = 'confirmado' then
    raise exception 'deposit_required' using errcode = '22023';
  end if;

  if v_estado = 'confirmado' and v_pago_tipo is distinct from 'anticipo' then
    raise exception 'deposit_required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('ouroboros:create_order'));
  v_folio := public.next_folio('OUR', p_fecha);

  insert into public.orders (
    folio, tipo, estado, cliente_nombre, cliente_whatsapp, metodo_entrega, direccion,
    notas_cliente, subtotal, desc_mayoreo, desc_cupon, personalizacion, envio, total,
    anticipo_requerido
  ) values (
    v_folio,
    v_tipo,
    v_estado,
    trim(p_order ->> 'cliente_nombre'),
    p_order ->> 'cliente_whatsapp',
    v_metodo,
    v_direccion,
    coalesce(p_order ->> 'notas_cliente', ''),
    v_subtotal,
    v_desc_mayoreo,
    v_desc_cupon,
    v_personalizacion,
    v_envio,
    v_total,
    v_anticipo
  )
  returning id into v_order_id;

  if v_tipo = 'catalogo' then
    insert into public.order_items (
      order_id, product_id, nombre_snapshot, color, talla, cantidad, precio_unitario,
      recargo_talla, personalizacion_texto
    )
    select
      v_order_id,
      nullif(item ->> 'product_id', '')::uuid,
      trim(item ->> 'nombre_snapshot'),
      nullif(trim(coalesce(item ->> 'color', '')), ''),
      nullif(trim(coalesce(item ->> 'talla', '')), ''),
      (item ->> 'cantidad')::integer,
      (item ->> 'precio_unitario')::integer,
      coalesce((item ->> 'recargo_talla')::integer, 0),
      nullif(trim(coalesce(item ->> 'personalizacion_texto', '')), '')
    from jsonb_array_elements(p_items) as item;
  else
    insert into public.custom_requests (
      order_id, custom_request_type_id, descripcion, cantidad, fecha_deseada, precio_final,
      tipo_producto, color, desglose_tallas
    ) values (
      v_order_id,
      nullif(p_request ->> 'custom_request_type_id', '')::uuid,
      trim(p_request ->> 'descripcion'),
      coalesce((p_request ->> 'cantidad')::integer, 1),
      nullif(p_request ->> 'fecha_deseada', '')::date,
      v_precio_final,
      nullif(trim(p_request ->> 'tipo_producto'), ''),
      nullif(trim(p_request ->> 'color'), ''),
      coalesce(p_request -> 'desglose_tallas', '[]'::jsonb)
    );
  end if;

  insert into public.order_events (order_id, estado, nota)
  values (v_order_id, 'pendiente', 'Pedido creado manualmente en el panel');

  if v_pago_monto is not null then
    insert into public.payments (order_id, tipo, monto, metodo, fecha)
    values (v_order_id, v_pago_tipo, v_pago_monto, v_pago_metodo, coalesce(p_fecha, now()));
  end if;

  if v_estado <> 'pendiente' then
    insert into public.order_events (order_id, estado, nota)
    values (v_order_id, v_estado, 'Estado inicial al crear el pedido en el panel');
  end if;

  return jsonb_build_object('id', v_order_id, 'folio', v_folio);
end;
$$;

revoke all on function public.admin_create_order(jsonb, jsonb, jsonb, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_create_order(jsonb, jsonb, jsonb, jsonb, timestamptz) to service_role;

-- 3. Admin update_custom_request (admin_update_custom_request)
drop function if exists public.admin_update_custom_request(uuid, uuid, text, integer, date);

create or replace function public.admin_update_custom_request(
  p_order_id uuid,
  p_custom_request_type_id uuid,
  p_descripcion text,
  p_cantidad integer,
  p_fecha_deseada date,
  p_tipo_producto text default null,
  p_color text default null,
  p_desglose_tallas jsonb default '[]'::jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  perform public.assert_order_admin();
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.estado in ('entregado', 'cancelado') then
    raise exception 'order_closed' using errcode = '22023';
  end if;
  if v_order.tipo <> 'encargo' then
    raise exception 'invalid_order_type' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_descripcion, ''))) = 0 or coalesce(p_cantidad, 0) <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  update public.custom_requests set
    custom_request_type_id = p_custom_request_type_id,
    descripcion = trim(p_descripcion),
    cantidad = p_cantidad,
    fecha_deseada = p_fecha_deseada,
    tipo_producto = nullif(trim(p_tipo_producto), ''),
    color = nullif(trim(p_color), ''),
    desglose_tallas = coalesce(p_desglose_tallas, '[]'::jsonb)
  where order_id = p_order_id;

  if not found then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_update_custom_request(uuid, uuid, text, integer, date, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_custom_request(uuid, uuid, text, integer, date, text, text, jsonb) to authenticated, service_role;

