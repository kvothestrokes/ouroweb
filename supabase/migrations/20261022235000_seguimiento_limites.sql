-- Ouroboros: tracking and public photo hardening (Fase 7 security review).
-- 1. Review photo paths contain the folio: anon reads only whether a review has a photo.
-- 2. reviews and gallery_items get updated_at, so image URLs change when they change.
-- 3. rate_limit_exceeded checks a limit without counting (failed-attempt limits).
-- 4. Index for the periodic cleanup of rate_limits.

alter table public.reviews
  add column tiene_foto boolean generated always as (foto_path is not null) stored,
  add column updated_at timestamptz not null default now();

revoke select on public.reviews from anon;
grant select (id, product_id, calificacion, texto, aprobada, created_at, tiene_foto, updated_at)
  on public.reviews to anon;

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

alter table public.gallery_items add column updated_at timestamptz not null default now();

create trigger gallery_items_set_updated_at
  before update on public.gallery_items
  for each row execute function public.set_updated_at();

create function public.rate_limit_exceeded(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select hits >= p_limit
    from public.rate_limits
    where key = p_key and window_start >= now() - make_interval(secs => p_window_seconds)
  ), false);
$$;

revoke all on function public.rate_limit_exceeded(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_exceeded(text, integer, integer) to service_role;

create index rate_limits_window_start_idx on public.rate_limits (window_start);
