-- Ouroboros: base schema (spec section 10).
-- Money columns are integer cents (MXN). Nullable quote fields mean "por cotizar".

-- Enums ---------------------------------------------------------------------

create type public.order_status as enum (
  'pendiente',
  'esperando_anticipo',
  'confirmado',
  'en_produccion',
  'listo',
  'enviado',
  'listo_para_recoger',
  'entregado',
  'cancelado'
);

create type public.order_type as enum ('catalogo', 'encargo');
create type public.delivery_method as enum ('recoger', 'domicilio', 'paqueteria');
create type public.payment_type as enum ('anticipo', 'abono', 'liquidacion');
create type public.coupon_type as enum ('porcentaje', 'fijo');
create type public.image_type as enum ('mockup', 'foto');
create type public.stock_mode as enum ('stock', 'bajo_pedido');

-- Helpers -------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Settings (single row) -----------------------------------------------------

create table public.settings (
  id boolean primary key default true check (id),
  whatsapp_negocio text not null check (whatsapp_negocio ~ '^\d{10,15}$'),
  datos_bancarios text not null default '',
  direccion_taller text not null default '',
  horarios text not null default '',
  anticipo_sugerido_pct integer not null default 50 check (anticipo_sugerido_pct between 0 and 100),
  updated_at timestamptz not null default now()
);

-- Catalog -------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre text not null,
  parent_id uuid references public.categories (id) on delete restrict,
  es_estrella boolean not null default false,
  orden integer not null default 0,
  imagen_hero text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);

create index categories_parent_id_idx on public.categories (parent_id);
-- At most one star subcategory per parent category.
create unique index categories_one_star_per_parent_idx
  on public.categories (parent_id) where es_estrella;

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre text not null,
  imagen text,
  created_at timestamptz not null default now()
);

create table public.garment_types (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tallas text[] not null default '{}',
  -- { "XXL": 3000, "3XL": 5000 } in cents
  recargos_talla jsonb not null default '{}' check (jsonb_typeof(recargos_talla) = 'object'),
  -- { "M": { "ancho_cm": 51, "largo_cm": 71 }, ... }
  guia_tallas jsonb not null default '{}' check (jsonb_typeof(guia_tallas) = 'object'),
  created_at timestamptz not null default now()
);

create table public.garment_bases (
  id uuid primary key default gen_random_uuid(),
  garment_type_id uuid not null references public.garment_types (id) on delete restrict,
  color_nombre text not null,
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  imagekit_path text not null,
  -- Print area in pixels of the real base image: { "x": 400, "y": 300, "ancho": 480 }
  area_impresion jsonb not null check (area_impresion ?& array['x', 'y', 'ancho']),
  es_clara boolean not null default false,
  created_at timestamptz not null default now(),
  unique (garment_type_id, color_nombre)
);

create index garment_bases_garment_type_id_idx on public.garment_bases (garment_type_id);

-- Original designs: never readable by the public (CLAUDE.md rule 4).
create table public.designs (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  path_prenda_oscura text,
  path_prenda_clara text,
  created_at timestamptz not null default now(),
  check (path_prenda_oscura is not null or path_prenda_clara is not null)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre text not null,
  descripcion text not null default '',
  category_id uuid not null references public.categories (id) on delete restrict,
  tipo_imagen public.image_type not null,
  garment_type_id uuid references public.garment_types (id) on delete restrict,
  design_id uuid references public.designs (id) on delete restrict,
  precio_base integer not null check (precio_base >= 0),
  modo_stock public.stock_mode not null default 'bajo_pedido',
  permite_personalizar boolean not null default false,
  activo boolean not null default false,
  destacado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tipo_imagen <> 'mockup' or (garment_type_id is not null and design_id is not null))
);

create index products_category_id_idx on public.products (category_id);
create index products_garment_type_id_idx on public.products (garment_type_id);
create index products_design_id_idx on public.products (design_id);
create index products_activo_idx on public.products (activo) where activo;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_colors (
  product_id uuid not null references public.products (id) on delete cascade,
  garment_base_id uuid not null references public.garment_bases (id) on delete restrict,
  primary key (product_id, garment_base_id)
);

create index product_colors_garment_base_id_idx on public.product_colors (garment_base_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  imagekit_path text not null,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index product_images_product_id_idx on public.product_images (product_id);

create table public.product_stock (
  product_id uuid not null references public.products (id) on delete cascade,
  garment_base_id uuid not null references public.garment_bases (id) on delete restrict,
  talla text not null,
  cantidad integer not null default 0 check (cantidad >= 0),
  primary key (product_id, garment_base_id, talla)
);

create index product_stock_garment_base_id_idx on public.product_stock (garment_base_id);

create table public.product_collections (
  product_id uuid not null references public.products (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  primary key (product_id, collection_id)
);

create index product_collections_collection_id_idx on public.product_collections (collection_id);

-- Pricing -------------------------------------------------------------------

create table public.volume_pricing (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products (id) on delete cascade,
  category_id uuid references public.categories (id) on delete cascade,
  cantidad_min integer not null check (cantidad_min >= 2),
  descuento_pct numeric(5, 2) not null check (descuento_pct > 0 and descuento_pct < 100),
  check (num_nonnulls(product_id, category_id) = 1)
);

create unique index volume_pricing_product_tier_idx
  on public.volume_pricing (product_id, cantidad_min) where product_id is not null;
create unique index volume_pricing_category_tier_idx
  on public.volume_pricing (category_id, cantidad_min) where category_id is not null;

create table public.custom_request_types (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  precio_desde integer check (precio_desde >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo = upper(codigo) and codigo ~ '^[A-Z0-9_-]{3,30}$'),
  tipo public.coupon_type not null,
  -- porcentaje: 1-100; fijo: cents
  valor integer not null check (valor > 0),
  minimo integer not null default 0 check (minimo >= 0),
  vigente_desde timestamptz,
  vigente_hasta timestamptz,
  usos_max integer check (usos_max > 0),
  usos integer not null default 0 check (usos >= 0),
  created_at timestamptz not null default now(),
  check (tipo <> 'porcentaje' or valor <= 100),
  check (vigente_desde is null or vigente_hasta is null or vigente_desde < vigente_hasta),
  check (usos_max is null or usos <= usos_max)
);

-- Orders --------------------------------------------------------------------

create table public.folio_counters (
  periodo text primary key check (periodo ~ '^\d{4}$'),
  ultimo_numero integer not null default 0 check (ultimo_numero >= 0)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique check (folio ~ '^[A-Z]{2,5}-\d{4}-\d{4}$'),
  tipo public.order_type not null,
  estado public.order_status not null default 'pendiente',
  cliente_nombre text not null check (length(trim(cliente_nombre)) > 0),
  -- Normalized as 52 + 10 national digits
  cliente_whatsapp text not null check (cliente_whatsapp ~ '^52\d{10}$'),
  metodo_entrega public.delivery_method not null,
  direccion jsonb,
  notas_cliente text not null default '',
  coupon_id uuid references public.coupons (id) on delete set null,
  subtotal integer not null check (subtotal >= 0),
  desc_mayoreo integer not null default 0 check (desc_mayoreo >= 0),
  desc_cupon integer not null default 0 check (desc_cupon >= 0),
  personalizacion integer check (personalizacion >= 0),
  envio integer check (envio >= 0),
  total integer not null check (total >= 0),
  anticipo_requerido integer check (anticipo_requerido >= 0),
  guia text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (metodo_entrega = 'recoger' or direccion is not null),
  check (desc_mayoreo + desc_cupon <= subtotal),
  -- Spec section 7; quote fields still "por cotizar" (null) count as 0.
  check (
    total = subtotal - desc_mayoreo - desc_cupon + coalesce(personalizacion, 0) + coalesce(envio, 0)
  )
);

create index orders_estado_idx on public.orders (estado);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_cliente_whatsapp_idx on public.orders (cliente_whatsapp);
create index orders_coupon_id_idx on public.orders (coupon_id);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Price snapshot: catalog changes never alter existing orders (CLAUDE.md rule 6).
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  nombre_snapshot text not null,
  color text,
  talla text,
  cantidad integer not null check (cantidad > 0),
  precio_unitario integer not null check (precio_unitario >= 0),
  recargo_talla integer not null default 0 check (recargo_talla >= 0),
  personalizacion_texto text,
  personalizacion_archivo text
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

create table public.custom_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  custom_request_type_id uuid references public.custom_request_types (id) on delete set null,
  descripcion text not null check (length(trim(descripcion)) > 0),
  cantidad integer not null default 1 check (cantidad > 0),
  fecha_deseada date,
  archivos_referencia text[] not null default '{}',
  -- Final quoted price captured by the admin (null = "por cotizar"); mirrored into orders.subtotal.
  precio_final integer check (precio_final >= 0)
);

create index custom_requests_type_id_idx on public.custom_requests (custom_request_type_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  tipo public.payment_type not null,
  monto integer not null check (monto > 0),
  metodo text not null,
  fecha timestamptz not null default now(),
  comprobante_path text
);

create index payments_order_id_idx on public.payments (order_id);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  estado public.order_status not null,
  nota text,
  fecha timestamptz not null default now()
);

create index order_events_order_id_idx on public.order_events (order_id, fecha);

create table public.order_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  texto text not null check (length(trim(texto)) > 0),
  fecha timestamptz not null default now()
);

create index order_notes_order_id_idx on public.order_notes (order_id);

create table public.order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  imagekit_path text not null,
  descripcion text,
  created_at timestamptz not null default now()
);

create index order_files_order_id_idx on public.order_files (order_id);

-- Content -------------------------------------------------------------------

create table public.wa_templates (
  clave text primary key check (clave ~ '^[a-z_]+$'),
  nombre text not null,
  cuerpo text not null,
  updated_at timestamptz not null default now()
);

create trigger wa_templates_set_updated_at
  before update on public.wa_templates
  for each row execute function public.set_updated_at();

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  calificacion integer not null check (calificacion between 1 and 5),
  texto text not null default '',
  foto_path text,
  aprobada boolean not null default false,
  created_at timestamptz not null default now()
);

create index reviews_order_id_idx on public.reviews (order_id);
create index reviews_product_id_idx on public.reviews (product_id);

create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  imagekit_path text not null,
  titulo text not null default '',
  collection_id uuid references public.collections (id) on delete set null,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index gallery_items_collection_id_idx on public.gallery_items (collection_id);
