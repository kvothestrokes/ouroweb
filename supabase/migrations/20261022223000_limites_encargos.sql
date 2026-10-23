-- Ouroboros: special request limits (Fase 5 security review).
-- guard_new_order gets the order type: special requests have their own cap inside the
-- store-wide one, and create_custom_order rejects hidden or unknown request types.

drop function public.guard_new_order(text);

create function public.guard_new_order(
  p_whatsapp text,
  p_tipo public.order_type default 'catalogo'
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_recent integer;
  v_recent_day integer;
begin
  -- One order at a time: makes the counts below exact under concurrency (orders are few).
  perform pg_advisory_xact_lock(hashtext('ouroboros:create_order'));

  -- Spam guard: at most 5 pending orders per WhatsApp number per hour.
  select count(*) into v_recent
  from public.orders
  where cliente_whatsapp = p_whatsapp
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

  -- Special requests are the cheapest to send, so they get a smaller share (20 per hour,
  -- 100 per day) and can never use up the room catalog orders need.
  if p_tipo = 'encargo' then
    select count(*) filter (where created_at > now() - interval '1 hour'),
           count(*)
    into v_recent, v_recent_day
    from public.orders
    where estado = 'pendiente'
      and tipo = 'encargo'
      and created_at > now() - interval '1 day';
    if v_recent >= 20 or v_recent_day >= 100 then
      raise exception 'store_busy' using errcode = 'P0001';
    end if;
  end if;
end;
$$;

revoke all on function public.guard_new_order(text, public.order_type) from public, anon, authenticated;
grant execute on function public.guard_new_order(text, public.order_type) to service_role;

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
    order_id, custom_request_type_id, descripcion, cantidad, fecha_deseada
  ) values (
    v_order_id,
    (p_request ->> 'custom_request_type_id')::uuid,
    p_request ->> 'descripcion',
    coalesce((p_request ->> 'cantidad')::integer, 1),
    (p_request ->> 'fecha_deseada')::date
  );

  insert into public.order_events (order_id, estado, nota)
  values (v_order_id, 'pendiente', 'Encargo creado desde la tienda');

  return v_folio;
end;
$$;
