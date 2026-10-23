-- Ouroboros: public store hardening (Fase 3 security review).
-- 1. anon reads only the public columns of products and product_images: the design id and
--    the ImageKit path of the original (unwatermarked) photos stay private.
-- 2. A product is public only when it is active and its category and that category's
--    parent (if any) are active too.

revoke select on public.products, public.product_images from anon;

grant select (
  id, slug, nombre, descripcion, category_id, tipo_imagen, garment_type_id, precio_base,
  modo_stock, permite_personalizar, activo, destacado, created_at, updated_at
) on public.products to anon;

grant select (id, product_id, orden, created_at) on public.product_images to anon;

-- Security definer so the check sees inactive categories too (anon cannot read them).
create function public.category_is_public(p_category_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.categories c
    left join public.categories parent on parent.id = c.parent_id
    where c.id = p_category_id
      and c.activo
      and (c.parent_id is null or parent.activo)
  );
$$;

revoke execute on function public.category_is_public(uuid) from public, anon, authenticated;
grant execute on function public.category_is_public(uuid) to anon, authenticated, service_role;

drop policy public_read_active on public.products;
create policy public_read_active on public.products
  for select to anon, authenticated
  using (activo and public.category_is_public(category_id));
