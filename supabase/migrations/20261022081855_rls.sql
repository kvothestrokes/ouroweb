-- Ouroboros: row level security (spec section 10, CLAUDE.md rule 3).
-- Public (anon) reads only the active catalog, collections, gallery and approved reviews.
-- The admin is the authenticated user whose app_metadata.role is 'admin'
-- (app_metadata can only be written with the secret key).
-- Orders are created only by server endpoints using the secret key, which bypasses RLS.

create function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- Grants: anon gets read-only access to public tables only; RLS filters rows.
revoke all on all tables in schema public from anon, authenticated;

grant select on
  public.categories,
  public.collections,
  public.garment_types,
  public.garment_bases,
  public.products,
  public.product_colors,
  public.product_images,
  public.product_stock,
  public.product_collections,
  public.volume_pricing,
  public.custom_request_types,
  public.gallery_items
to anon;

-- Approved reviews are public, but not the order they belong to.
grant select (id, product_id, calificacion, texto, foto_path, aprobada, created_at)
  on public.reviews to anon;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- Tables and functions created by future migrations start closed: each one must
-- grant access and enable RLS explicitly.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- Enable RLS on every table -------------------------------------------------
-- folio_counters gets no admin policy: only next_folio (service_role) touches it,
-- so a manual reset can never collide with existing folios.

do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
    continue when t.tablename = 'folio_counters';
    execute format(
      'create policy admin_all on public.%I for all to authenticated '
      'using ((select public.is_admin())) with check ((select public.is_admin()))',
      t.tablename
    );
  end loop;
end;
$$;

-- Public read policies ------------------------------------------------------

create policy public_read_active on public.categories
  for select to anon, authenticated
  using (activo);

create policy public_read on public.collections
  for select to anon, authenticated
  using (true);

create policy public_read on public.garment_types
  for select to anon, authenticated
  using (true);

create policy public_read on public.garment_bases
  for select to anon, authenticated
  using (true);

create policy public_read_active on public.products
  for select to anon, authenticated
  using (activo);

create policy public_read_active_product on public.product_colors
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.activo));

create policy public_read_active_product on public.product_images
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.activo));

create policy public_read_active_product on public.product_stock
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.activo));

create policy public_read_active_product on public.product_collections
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.activo));

create policy public_read_active on public.volume_pricing
  for select to anon, authenticated
  using (
    (product_id is not null and exists (
      select 1 from public.products p where p.id = product_id and p.activo
    ))
    or (category_id is not null and exists (
      select 1 from public.categories c where c.id = category_id and c.activo
    ))
  );

create policy public_read_active on public.custom_request_types
  for select to anon, authenticated
  using (activo);

create policy public_read_approved on public.reviews
  for select to anon, authenticated
  using (aprobada);

create policy public_read on public.gallery_items
  for select to anon, authenticated
  using (true);
