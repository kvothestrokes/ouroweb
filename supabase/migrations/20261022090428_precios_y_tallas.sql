-- Ouroboros: global prices per garment type and the real size range (user decision 2026-10-22).
-- Garment products take their price from their garment type, so changing it once updates
-- every product; products.precio_base becomes an optional override for them and stays
-- required for products without a garment type (mugs, candles, 3D prints...).

alter table public.garment_types
  add column precio_normal integer check (precio_normal >= 0),
  add column precio_mayoreo integer check (precio_mayoreo >= 0),
  -- TODO(negocio): minimum pieces for the wholesale price (spec section 13).
  add column mayoreo_cantidad_min integer check (mayoreo_cantidad_min >= 2),
  add constraint garment_types_mayoreo_lte_normal
    check (precio_mayoreo is null or precio_normal is null or precio_mayoreo <= precio_normal);

comment on column public.garment_types.precio_normal is 'Unit price in cents for every product of this garment type';
comment on column public.garment_types.precio_mayoreo is 'Wholesale unit price in cents, applied from mayoreo_cantidad_min pieces';

alter table public.products alter column precio_base drop not null;
alter table public.products
  add constraint products_precio_base_required
    check (precio_base is not null or garment_type_id is not null);

comment on column public.products.precio_base is 'Price in cents; null means the garment type price applies';

update public.garment_types
set tallas = array['CH', 'M', 'G', 'XG', 'XXG']
where nombre in ('Playera', 'Sudadera');

-- TODO(negocio): Sudadera prices (spec section 13).
update public.garment_types
set precio_normal = 17000, precio_mayoreo = 15000
where nombre = 'Playera';
