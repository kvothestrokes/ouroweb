-- Ouroboros: base garment photos are local server files, not ImageKit paths
-- (user decision 2026-10-22). `foto` holds "<garment-type>/<color>", the file
-- src/lib/server/assets/bases/<garment-type>/<color>.jpg. No rows exist yet.

alter table public.garment_bases rename column imagekit_path to foto;

alter table public.garment_bases
  add constraint garment_bases_foto_format
    check (foto ~ '^[a-z0-9]+(-[a-z0-9]+)*/[a-z0-9]+(-[a-z0-9]+)*$'),
  add constraint garment_bases_foto_key unique (foto);

comment on column public.garment_bases.foto is 'Local photo key "<garment-type>/<color>" (server-only asset)';
