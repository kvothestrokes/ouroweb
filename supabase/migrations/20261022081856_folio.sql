-- Ouroboros: atomic order folio PREFIX-YYMM-NNNN (spec section 10).
-- The counter restarts every month (America/Mexico_City). Only the server
-- (secret key / service_role) may call it, in the same operation that inserts the order.

create function public.next_folio(
  p_prefijo text default 'OUR',
  p_fecha timestamptz default now()
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_periodo text;
  v_numero integer;
begin
  if p_prefijo is null or p_prefijo !~ '^[A-Z]{2,5}$' then
    raise exception 'invalid folio prefix: %', p_prefijo using errcode = '22023';
  end if;

  v_periodo := to_char(p_fecha at time zone 'America/Mexico_City', 'YYMM');

  insert into public.folio_counters as fc (periodo, ultimo_numero)
  values (v_periodo, 1)
  on conflict (periodo) do update set ultimo_numero = fc.ultimo_numero + 1
  returning fc.ultimo_numero into v_numero;

  if v_numero > 9999 then
    raise exception 'folio counter exhausted for period %', v_periodo using errcode = '22003';
  end if;

  return p_prefijo || '-' || v_periodo || '-' || lpad(v_numero::text, 4, '0');
end;
$$;

revoke all on function public.next_folio(text, timestamptz) from public, anon, authenticated;
grant execute on function public.next_folio(text, timestamptz) to service_role;
