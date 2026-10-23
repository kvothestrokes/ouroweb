-- Ouroboros: admin order management (Fase 6, spec 6.3 and 6.4).
-- Quote, status changes and payments go through these functions so the rules live in one
-- place: valid transitions only, a deposit before confirming, payments up to the balance,
-- and every status change recorded in order_events. Only the admin (or the server) runs them.

create function public.assert_order_admin()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not (public.is_admin() or current_user = 'service_role') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;

-- Captures what is quoted by WhatsApp; null keeps a field "por cotizar".
create function public.quote_order(
  p_order_id uuid,
  p_envio integer,
  p_personalizacion integer,
  p_precio_final integer,
  p_anticipo integer
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_subtotal integer;
begin
  perform public.assert_order_admin();
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.estado in ('entregado', 'cancelado') then
    raise exception 'order_closed' using errcode = '22023';
  end if;

  v_subtotal := v_order.subtotal;
  if v_order.tipo = 'encargo' then
    update public.custom_requests set precio_final = p_precio_final where order_id = p_order_id;
    v_subtotal := coalesce(p_precio_final, 0);
  end if;

  update public.orders set
    subtotal = v_subtotal,
    envio = p_envio,
    personalizacion = p_personalizacion,
    anticipo_requerido = p_anticipo,
    total = v_subtotal - desc_mayoreo - desc_cupon + coalesce(p_personalizacion, 0) + coalesce(p_envio, 0)
  where id = p_order_id;
end;
$$;

create function public.change_order_status(
  p_order_id uuid,
  p_estado public.order_status,
  p_nota text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_allowed public.order_status[];
begin
  perform public.assert_order_admin();
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  v_allowed := case v_order.estado
    when 'pendiente' then array['esperando_anticipo', 'cancelado']::public.order_status[]
    when 'esperando_anticipo' then array['confirmado', 'cancelado']::public.order_status[]
    when 'confirmado' then array['en_produccion', 'cancelado']::public.order_status[]
    when 'en_produccion' then array['listo']::public.order_status[]
    when 'listo' then case when v_order.metodo_entrega = 'recoger'
      then array['listo_para_recoger']::public.order_status[]
      else array['enviado']::public.order_status[] end
    when 'enviado' then array['entregado']::public.order_status[]
    when 'listo_para_recoger' then array['entregado']::public.order_status[]
    else array[]::public.order_status[]
  end;
  if not (p_estado = any (v_allowed)) then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;

  if p_estado = 'confirmado' and not exists (
    select 1 from public.payments where order_id = p_order_id and tipo = 'anticipo'
  ) then
    raise exception 'deposit_required' using errcode = '22023';
  end if;

  update public.orders set estado = p_estado where id = p_order_id;
  insert into public.order_events (order_id, estado, nota)
  values (p_order_id, p_estado, nullif(trim(p_nota), ''));
end;
$$;

create function public.add_payment(
  p_order_id uuid,
  p_tipo public.payment_type,
  p_monto integer,
  p_metodo text,
  p_fecha timestamptz default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_paid integer;
  v_id uuid;
begin
  perform public.assert_order_admin();
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.estado = 'cancelado' then
    raise exception 'order_closed' using errcode = '22023';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  select coalesce(sum(monto), 0) into v_paid from public.payments where order_id = p_order_id;
  if v_paid + p_monto > v_order.total then
    raise exception 'payment_exceeds_balance' using errcode = '22023';
  end if;

  insert into public.payments (order_id, tipo, monto, metodo, fecha)
  values (p_order_id, p_tipo, p_monto, coalesce(nullif(trim(p_metodo), ''), 'Sin especificar'), coalesce(p_fecha, now()))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.assert_order_admin() from public, anon, authenticated;
revoke all on function public.quote_order(uuid, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.change_order_status(uuid, public.order_status, text) from public, anon, authenticated;
revoke all on function public.add_payment(uuid, public.payment_type, integer, text, timestamptz) from public, anon, authenticated;

grant execute on function public.assert_order_admin() to authenticated, service_role;
grant execute on function public.quote_order(uuid, integer, integer, integer, integer) to authenticated, service_role;
grant execute on function public.change_order_status(uuid, public.order_status, text) to authenticated, service_role;
grant execute on function public.add_payment(uuid, public.payment_type, integer, text, timestamptz) to authenticated, service_role;
