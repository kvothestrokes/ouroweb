-- Ouroboros: quote_order guards (Fase 6 security review).
-- A new quote can never leave the total below what was already paid, the deposit cannot be
-- larger than the total, and quoting problems get named errors for the panel.

create or replace function public.quote_order(
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
  if coalesce(p_envio, 0) < 0 or coalesce(p_personalizacion, 0) < 0
     or coalesce(p_precio_final, 0) < 0 or coalesce(p_anticipo, 0) < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  v_subtotal := v_order.subtotal;
  if v_order.tipo = 'encargo' then
    v_subtotal := coalesce(p_precio_final, 0);
    if v_order.desc_mayoreo + v_order.desc_cupon > v_subtotal then
      raise exception 'discount_above_price' using errcode = '22023';
    end if;
    update public.custom_requests set precio_final = p_precio_final where order_id = p_order_id;
    if not found then
      raise exception 'request_not_found' using errcode = 'P0002';
    end if;
  end if;

  v_total := v_subtotal - v_order.desc_mayoreo - v_order.desc_cupon
    + coalesce(p_personalizacion, 0) + coalesce(p_envio, 0);

  select coalesce(sum(monto), 0) into v_paid from public.payments where order_id = p_order_id;
  if v_total < v_paid then
    raise exception 'quote_below_paid' using errcode = '22023';
  end if;
  if p_anticipo is not null and p_anticipo > v_total then
    raise exception 'deposit_above_total' using errcode = '22023';
  end if;

  update public.orders set
    subtotal = v_subtotal,
    envio = p_envio,
    personalizacion = p_personalizacion,
    anticipo_requerido = p_anticipo,
    total = v_total
  where id = p_order_id;
end;
$$;
