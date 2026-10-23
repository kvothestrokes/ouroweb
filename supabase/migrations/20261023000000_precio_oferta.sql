-- Ouroboros: offer price per product (Fase 8 decision, 2026-10-22).
-- Prices are only normal, bulk (garment type) and an optional offer price per product,
-- optionally until a date (inclusive, Mexico City). Volume tiers and coupons are dropped.

alter table public.products
  add column precio_oferta integer check (precio_oferta >= 0),
  add column oferta_hasta date,
  add constraint products_oferta_hasta_needs_price check (oferta_hasta is null or precio_oferta is not null);

grant select (precio_oferta, oferta_hasta) on public.products to anon;

create or replace function public.save_product(
  p_id uuid,
  p_product jsonb,
  p_colors uuid[],
  p_collections uuid[],
  p_stock jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_row public.products%rowtype;
begin
  v_row := jsonb_populate_record(null::public.products, p_product);

  if p_id is null then
    insert into public.products (
      slug, nombre, descripcion, category_id, tipo_imagen, garment_type_id, design_id,
      precio_base, precio_oferta, oferta_hasta, modo_stock, permite_personalizar, activo, destacado
    ) values (
      v_row.slug, v_row.nombre, coalesce(v_row.descripcion, ''), v_row.category_id,
      v_row.tipo_imagen, v_row.garment_type_id, v_row.design_id, v_row.precio_base,
      v_row.precio_oferta, v_row.oferta_hasta,
      coalesce(v_row.modo_stock, 'bajo_pedido'), coalesce(v_row.permite_personalizar, false),
      coalesce(v_row.activo, false), coalesce(v_row.destacado, false)
    )
    returning id into v_id;
  else
    update public.products set
      slug = v_row.slug,
      nombre = v_row.nombre,
      descripcion = coalesce(v_row.descripcion, ''),
      category_id = v_row.category_id,
      tipo_imagen = v_row.tipo_imagen,
      garment_type_id = v_row.garment_type_id,
      design_id = v_row.design_id,
      precio_base = v_row.precio_base,
      precio_oferta = v_row.precio_oferta,
      oferta_hasta = v_row.oferta_hasta,
      modo_stock = coalesce(v_row.modo_stock, 'bajo_pedido'),
      permite_personalizar = coalesce(v_row.permite_personalizar, false),
      activo = coalesce(v_row.activo, false),
      destacado = coalesce(v_row.destacado, false)
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'product % not found', p_id using errcode = 'P0002';
    end if;
  end if;

  -- Colors must be bases of the product's garment type.
  if exists (
    select 1
    from unnest(coalesce(p_colors, '{}')) as c(id)
    left join public.garment_bases gb on gb.id = c.id
    where gb.id is null or gb.garment_type_id is distinct from v_row.garment_type_id
  ) then
    raise exception 'colors must belong to the product garment type' using errcode = '23514';
  end if;

  delete from public.product_colors where product_id = v_id;
  insert into public.product_colors (product_id, garment_base_id)
  select distinct v_id, c.id from unnest(coalesce(p_colors, '{}')) as c(id);

  delete from public.product_collections where product_id = v_id;
  insert into public.product_collections (product_id, collection_id)
  select distinct v_id, c.id from unnest(coalesce(p_collections, '{}')) as c(id);

  -- Stock rows only for the product's colors and its garment type sizes.
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_stock, '[]')) as s(e)
    where not ((s.e ->> 'garment_base_id')::uuid = any (coalesce(p_colors, '{}')))
      or not exists (
        select 1 from public.garment_types gt
        where gt.id = v_row.garment_type_id and (s.e ->> 'talla') = any (gt.tallas)
      )
  ) then
    raise exception 'stock must use the product colors and sizes' using errcode = '23514';
  end if;

  delete from public.product_stock where product_id = v_id;
  insert into public.product_stock (product_id, garment_base_id, talla, cantidad)
  select v_id, (s.e ->> 'garment_base_id')::uuid, s.e ->> 'talla', (s.e ->> 'cantidad')::integer
  from jsonb_array_elements(coalesce(p_stock, '[]')) as s(e);

  return v_id;
end;
$$;
