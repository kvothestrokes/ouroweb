-- Ouroboros: allow setting/overriding base price in quote_order for all order types.
-- For 'encargo': updates custom_requests.precio_final and sets orders.subtotal.
-- For 'catalogo': if p_precio_final is not null, sets orders.subtotal to p_precio_final;
--                 otherwise preserves existing orders.subtotal from line items.

create or replace function public.quote_order(
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

  v_subtotal := coalesce(p_precio_final, v_order.subtotal);
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

