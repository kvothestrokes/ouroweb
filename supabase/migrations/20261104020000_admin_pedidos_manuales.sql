-- Ouroboros: manual order creation, full order parameter editing, and status rollback/reopen for admin.
-- Preserves all financial invariants on public.orders:
--   total = subtotal - desc_mayoreo - desc_cupon + coalesce(personalizacion, 0) + coalesce(envio, 0)
--   desc_mayoreo + desc_cupon <= subtotal
--   total >= sum(payments.monto)
--   anticipo_requerido <= total

-- 1. Extend quote_order with optional discount parameters (backwards-compatible with 5-arg callers).
drop function if exists public.quote_order(uuid, integer, integer, integer, integer);

create function public.quote_order(
  p_order_id uuid,
  p_envio integer,
  p_personalizacion integer,
  p_precio_final integer,
  p_anticipo integer,
  p_desc_mayoreo integer default null,
  p_desc_cupon integer default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_subtotal integer;
  v_desc_mayoreo integer;
  v_desc_cupon integer;
  v_envio integer;
  v_total integer;
  v_paid integer;
begin
  perform public.assert_order_admin();
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.estado in ('entregado', 'cancelado') then
    raise exception 'order_closed' using errcode = '22023';
  end if;

  v_desc_mayoreo := coalesce(p_desc_mayoreo, v_order.desc_mayoreo);
  v_desc_cupon := coalesce(p_desc_cupon, v_order.desc_cupon);
  v_envio := case when v_order.metodo_entrega = 'recoger' then 0 else p_envio end;

  if coalesce(v_envio, 0) < 0 or coalesce(p_personalizacion, 0) < 0
     or coalesce(p_precio_final, 0) < 0 or coalesce(p_anticipo, 0) < 0
     or v_desc_mayoreo < 0 or v_desc_cupon < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  v_subtotal := v_order.subtotal;
  if v_order.tipo = 'encargo' then
    v_subtotal := coalesce(p_precio_final, 0);
    if v_desc_mayoreo + v_desc_cupon > v_subtotal then
      raise exception 'discount_above_price' using errcode = '22023';
    end if;
    update public.custom_requests set precio_final = p_precio_final where order_id = p_order_id;
    if not found then
      raise exception 'request_not_found' using errcode = 'P0002';
    end if;
  else
    if v_desc_mayoreo + v_desc_cupon > v_subtotal then
      raise exception 'discount_above_price' using errcode = '22023';
    end if;
  end if;

  v_total := v_subtotal - v_desc_mayoreo - v_desc_cupon
    + coalesce(p_personalizacion, 0) + coalesce(v_envio, 0);

  select coalesce(sum(monto), 0) into v_paid from public.payments where order_id = p_order_id;
  if v_total < v_paid then
    raise exception 'quote_below_paid' using errcode = '22023';
  end if;
  if p_anticipo is not null and p_anticipo > v_total then
    raise exception 'deposit_above_total' using errcode = '22023';
  end if;

  update public.orders set
    subtotal = v_subtotal,
    desc_mayoreo = v_desc_mayoreo,
    desc_cupon = v_desc_cupon,
    envio = v_envio,
    personalizacion = p_personalizacion,
    anticipo_requerido = p_anticipo,
    total = v_total
  where id = p_order_id;
end;
$$;

revoke all on function public.quote_order(uuid, integer, integer, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.quote_order(uuid, integer, integer, integer, integer, integer, integer) to authenticated, service_role;

-- 2. Manual order creation from admin panel (supports both 'catalogo' and 'encargo', optional quote & initial payment).
create function public.admin_create_order(
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
      order_id, custom_request_type_id, descripcion, cantidad, fecha_deseada, precio_final
    ) values (
      v_order_id,
      nullif(p_request ->> 'custom_request_type_id', '')::uuid,
      trim(p_request ->> 'descripcion'),
      coalesce((p_request ->> 'cantidad')::integer, 1),
      nullif(p_request ->> 'fecha_deseada', '')::date,
      v_precio_final
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

-- 3. Update customer, delivery method, address, customer notes, and tracking code.
create function public.admin_update_order_details(
  p_order_id uuid,
  p_cliente_nombre text,
  p_cliente_whatsapp text,
  p_metodo_entrega public.delivery_method,
  p_direccion jsonb,
  p_notas_cliente text,
  p_guia text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_direccion jsonb;
  v_envio integer;
  v_total integer;
  v_paid integer;
  v_anticipo integer;
begin
  perform public.assert_order_admin();
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.estado in ('entregado', 'cancelado') then
    raise exception 'order_closed' using errcode = '22023';
  end if;

  if length(trim(coalesce(p_cliente_nombre, ''))) = 0 or coalesce(p_cliente_whatsapp, '') !~ '^52\d{10}$' then
    raise exception 'invalid_contact' using errcode = '22023';
  end if;

  v_direccion := case
    when p_metodo_entrega = 'recoger' then null
    when jsonb_typeof(p_direccion) = 'object' then p_direccion
    else null
  end;
  if p_metodo_entrega <> 'recoger' and v_direccion is null then
    raise exception 'address_required' using errcode = '22023';
  end if;

  v_envio := case when p_metodo_entrega = 'recoger' then 0 else v_order.envio end;
  v_total := v_order.subtotal - v_order.desc_mayoreo - v_order.desc_cupon
    + coalesce(v_order.personalizacion, 0) + coalesce(v_envio, 0);

  select coalesce(sum(monto), 0) into v_paid from public.payments where order_id = p_order_id;
  if v_total < v_paid then
    raise exception 'quote_below_paid' using errcode = '22023';
  end if;

  v_anticipo := case
    when v_order.anticipo_requerido is not null and v_order.anticipo_requerido > v_total then v_total
    else v_order.anticipo_requerido
  end;

  update public.orders set
    cliente_nombre = trim(p_cliente_nombre),
    cliente_whatsapp = p_cliente_whatsapp,
    metodo_entrega = p_metodo_entrega,
    direccion = v_direccion,
    notas_cliente = coalesce(p_notas_cliente, ''),
    guia = case when p_metodo_entrega = 'paqueteria' then nullif(trim(coalesce(p_guia, '')), '') else null end,
    envio = v_envio,
    total = v_total,
    anticipo_requerido = v_anticipo
  where id = p_order_id;
end;
$$;

revoke all on function public.admin_update_order_details(uuid, text, text, public.delivery_method, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.admin_update_order_details(uuid, text, text, public.delivery_method, jsonb, text, text) to authenticated, service_role;

-- 4. Replace line items on a catalog order and recalculate subtotal/total atomically.
create function public.admin_save_order_items(
  p_order_id uuid,
  p_items jsonb,
  p_desc_mayoreo integer default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_subtotal integer;
  v_desc_mayoreo integer;
  v_total integer;
  v_paid integer;
  v_anticipo integer;
begin
  perform public.assert_order_admin();
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.estado in ('entregado', 'cancelado') then
    raise exception 'order_closed' using errcode = '22023';
  end if;
  if v_order.tipo <> 'catalogo' then
    raise exception 'invalid_order_type' using errcode = '22023';
  end if;

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

  v_desc_mayoreo := coalesce(p_desc_mayoreo, v_order.desc_mayoreo);
  if v_desc_mayoreo < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if v_desc_mayoreo + v_order.desc_cupon > v_subtotal then
    raise exception 'discount_above_price' using errcode = '22023';
  end if;

  v_total := v_subtotal - v_desc_mayoreo - v_order.desc_cupon
    + coalesce(v_order.personalizacion, 0) + coalesce(v_order.envio, 0);

  select coalesce(sum(monto), 0) into v_paid from public.payments where order_id = p_order_id;
  if v_total < v_paid then
    raise exception 'quote_below_paid' using errcode = '22023';
  end if;

  v_anticipo := case
    when v_order.anticipo_requerido is not null and v_order.anticipo_requerido > v_total then v_total
    else v_order.anticipo_requerido
  end;

  delete from public.order_items where order_id = p_order_id;

  insert into public.order_items (
    order_id, product_id, nombre_snapshot, color, talla, cantidad, precio_unitario,
    recargo_talla, personalizacion_texto
  )
  select
    p_order_id,
    nullif(item ->> 'product_id', '')::uuid,
    trim(item ->> 'nombre_snapshot'),
    nullif(trim(coalesce(item ->> 'color', '')), ''),
    nullif(trim(coalesce(item ->> 'talla', '')), ''),
    (item ->> 'cantidad')::integer,
    (item ->> 'precio_unitario')::integer,
    coalesce((item ->> 'recargo_talla')::integer, 0),
    nullif(trim(coalesce(item ->> 'personalizacion_texto', '')), '')
  from jsonb_array_elements(p_items) as item;

  update public.orders set
    subtotal = v_subtotal,
    desc_mayoreo = v_desc_mayoreo,
    total = v_total,
    anticipo_requerido = v_anticipo
  where id = p_order_id;
end;
$$;

revoke all on function public.admin_save_order_items(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.admin_save_order_items(uuid, jsonb, integer) to authenticated, service_role;

-- 5. Update custom request parameters on an 'encargo' order.
create function public.admin_update_custom_request(
  p_order_id uuid,
  p_custom_request_type_id uuid,
  p_descripcion text,
  p_cantidad integer,
  p_fecha_deseada date
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
    fecha_deseada = p_fecha_deseada
  where order_id = p_order_id;

  if not found then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_update_custom_request(uuid, uuid, text, integer, date) from public, anon, authenticated;
grant execute on function public.admin_update_custom_request(uuid, uuid, text, integer, date) to authenticated, service_role;

-- 6. Delete a mis-entered payment while preserving the deposit requirement for confirmed orders.
create function public.admin_delete_payment(
  p_order_id uuid,
  p_payment_id uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
begin
  perform public.assert_order_admin();
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  select * into v_payment from public.payments where id = p_payment_id and order_id = p_order_id;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;

  if v_payment.tipo = 'anticipo'
     and v_order.estado in ('confirmado', 'en_produccion', 'listo', 'enviado', 'listo_para_recoger', 'entregado')
     and not exists (
       select 1 from public.payments
       where order_id = p_order_id and tipo = 'anticipo' and id <> p_payment_id
     ) then
    raise exception 'deposit_required' using errcode = '22023';
  end if;

  delete from public.payments where id = p_payment_id and order_id = p_order_id;
end;
$$;

revoke all on function public.admin_delete_payment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_payment(uuid, uuid) to authenticated, service_role;

-- 7. Revert or reopen an order status with a mandatory audit note in order_events (Spec S4).
create function public.admin_override_order_status(
  p_order_id uuid,
  p_estado public.order_status,
  p_nota text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_nota text;
begin
  perform public.assert_order_admin();
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  v_nota := nullif(trim(coalesce(p_nota, '')), '');
  if v_nota is null then
    raise exception 'note_required' using errcode = '22023';
  end if;

  if v_order.estado = p_estado then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;

  if p_estado = 'enviado' and v_order.metodo_entrega = 'recoger' then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  if p_estado = 'listo_para_recoger' and v_order.metodo_entrega <> 'recoger' then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;

  if p_estado in ('confirmado', 'en_produccion', 'listo', 'enviado', 'listo_para_recoger', 'entregado')
     and not exists (
       select 1 from public.payments where order_id = p_order_id and tipo = 'anticipo'
     ) then
    raise exception 'deposit_required' using errcode = '22023';
  end if;

  update public.orders set estado = p_estado where id = p_order_id;
  insert into public.order_events (order_id, estado, nota)
  values (p_order_id, p_estado, '[Corrección] ' || v_nota);
end;
$$;

revoke all on function public.admin_override_order_status(uuid, public.order_status, text) from public, anon, authenticated;
grant execute on function public.admin_override_order_status(uuid, public.order_status, text) to authenticated, service_role;

