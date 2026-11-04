-- Ouroboros: Saved B2B prospects & preloaded company logos for personalized mockups (/admin/empresas & /empresas).

create table public.b2b_prospects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  empresa text not null check (length(trim(empresa)) > 0),
  contacto text,
  whatsapp text,
  paquete_slug text,
  nota text,
  logo_imagekit_path text,
  logo_fondo_sugerido text not null default 'dark' check (logo_fondo_sugerido in ('dark', 'light')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index b2b_prospects_activo_updated_idx on public.b2b_prospects (activo, updated_at desc);

create trigger b2b_prospects_set_updated_at
  before update on public.b2b_prospects
  for each row execute function public.set_updated_at();

alter table public.b2b_prospects enable row level security;

grant select on public.b2b_prospects to anon;
grant select, insert, update, delete on public.b2b_prospects to authenticated;
grant all on public.b2b_prospects to service_role;

create policy public_read_active on public.b2b_prospects
  for select to anon, authenticated
  using (activo);

create policy admin_all on public.b2b_prospects
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
