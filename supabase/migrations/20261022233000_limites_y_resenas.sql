-- Ouroboros: durable rate limits and one review per order (Fase 7).
-- Serverless instances do not share memory, so request limits live in Postgres. Order
-- tracking guesses (folio + 4 digits), orders and special requests use them.

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);

alter table public.rate_limits enable row level security;

-- True when the request is allowed; counts it inside a fixed window per key.
create function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as rl (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case
      when rl.window_start < now() - make_interval(secs => p_window_seconds) then now()
      else rl.window_start end,
    hits = case
      when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1
      else rl.hits + 1 end
  returning hits into v_hits;

  -- Keep the table small: drop windows that ended long ago (cheap, indexed by key).
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;
grant select, insert, update, delete on public.rate_limits to service_role;

create unique index reviews_one_per_order_idx on public.reviews (order_id);
