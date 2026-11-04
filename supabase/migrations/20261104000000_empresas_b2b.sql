-- Ouroboros: B2B / Corporate channel (/empresas and /admin/empresas).
-- Configurable corporate landing settings, pre-built corporate packages, B2B portfolio items,
-- and WhatsApp templates for outbound prospecting and incoming B2B quote requests.

create table public.b2b_settings (
  id smallint primary key default 1 check (id = 1),
  badge_texto text not null default 'División Corporativa · Mayoreo y Personalización',
  hero_titulo text not null default 'Tu marca en piezas que tu equipo y clientes sí van a conservar.',
  hero_subtitulo text not null default 'Uniformes, termos grabados en láser, tazas sublimadas, reconocimientos 3D y kits de bienvenida hechos en taller con control de calidad pieza por pieza.',
  stat_piezas_entregadas text not null default '+1,500 piezas entregadas',
  stat_tiempo_respuesta text not null default 'Cotización en < 2 horas',
  stat_minimo_piezas text not null default 'Desde 10 piezas por lote',
  garantias jsonb not null default '[]'::jsonb check (jsonb_typeof(garantias) = 'array'),
  escalas_simulador jsonb not null default '[]'::jsonb check (jsonb_typeof(escalas_simulador) = 'array'),
  faqs jsonb not null default '[]'::jsonb check (jsonb_typeof(faqs) = 'array'),
  updated_at timestamptz not null default now()
);

create trigger b2b_settings_set_updated_at
  before update on public.b2b_settings
  for each row execute function public.set_updated_at();

create table public.b2b_packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  nombre text not null check (length(trim(nombre)) > 0),
  subtitulo text not null default '',
  descripcion text not null default '',
  incluye text[] not null default '{}',
  precio_desde integer not null check (precio_desde >= 0),
  cantidad_minima integer not null default 10 check (cantidad_minima > 0),
  imagekit_path text,
  destacado boolean not null default false,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index b2b_packages_activo_orden_idx on public.b2b_packages (activo, orden);

create trigger b2b_packages_set_updated_at
  before update on public.b2b_packages
  for each row execute function public.set_updated_at();

create table public.b2b_portfolio (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 0),
  giro_empresa text not null default '',
  imagekit_path text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index b2b_portfolio_activo_orden_idx on public.b2b_portfolio (activo, orden);

create trigger b2b_portfolio_set_updated_at
  before update on public.b2b_portfolio
  for each row execute function public.set_updated_at();

-- RLS & Grants (CLAUDE.md rule 3 & 20261022081855_rls.sql) -------------------

alter table public.b2b_settings enable row level security;
alter table public.b2b_packages enable row level security;
alter table public.b2b_portfolio enable row level security;

grant select on public.b2b_settings, public.b2b_packages, public.b2b_portfolio to anon;
grant select, insert, update, delete on public.b2b_settings, public.b2b_packages, public.b2b_portfolio to authenticated;
grant all on public.b2b_settings, public.b2b_packages, public.b2b_portfolio to service_role;

create policy public_read on public.b2b_settings
  for select to anon, authenticated
  using (true);

create policy public_read_active on public.b2b_packages
  for select to anon, authenticated
  using (activo);

create policy public_read_active on public.b2b_portfolio
  for select to anon, authenticated
  using (activo);

create policy admin_all on public.b2b_settings
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy admin_all on public.b2b_packages
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy admin_all on public.b2b_portfolio
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Initial seeds --------------------------------------------------------------

insert into public.b2b_settings (
  id,
  garantias,
  escalas_simulador,
  faqs
) values (
  1,
  '[
    {
      "titulo": "Mockup digital sin costo antes de producir",
      "descripcion": "Preparamos una vista previa con tu logotipo sobre la prenda, termo o pieza real para que apruebes proporciones y colores con total certeza."
    },
    {
      "titulo": "Compromiso de entrega con folio en vivo",
      "descripcion": "Sabemos que un evento o ingreso de personal no puede esperar. Tu pedido lleva un folio único (OUR-AAMM-NNNN) para consultar su avance en todo momento."
    },
    {
      "titulo": "Esquema 50/50 con evidencia fotográfica",
      "descripcion": "Iniciamos producción con el 50% de anticipo y liquidas el resto cuando te enviamos fotos y video de tu lote terminado."
    }
  ]'::jsonb,
  '[
    {
      "id": "playeras",
      "nombre": "Playeras estampadas con tu logo",
      "unidad": "playera",
      "precio_normal": 17000,
      "escalas": [
        { "min": 10, "precio_unitario": 15000, "etiqueta": "10 a 24 pzas" },
        { "min": 25, "precio_unitario": 14000, "etiqueta": "25 a 49 pzas" },
        { "min": 50, "precio_unitario": 13000, "etiqueta": "50 a 99 pzas" },
        { "min": 100, "precio_unitario": 12000, "etiqueta": "100+ pzas" }
      ]
    },
    {
      "id": "termos",
      "nombre": "Termos con grabado láser permanente",
      "unidad": "termo",
      "precio_normal": 28000,
      "escalas": [
        { "min": 10, "precio_unitario": 24500, "etiqueta": "10 a 24 pzas" },
        { "min": 25, "precio_unitario": 22500, "etiqueta": "25 a 49 pzas" },
        { "min": 50, "precio_unitario": 20500, "etiqueta": "50 a 99 pzas" },
        { "min": 100, "precio_unitario": 19000, "etiqueta": "100+ pzas" }
      ]
    },
    {
      "id": "tazas",
      "nombre": "Tazas sublimadas a todo color",
      "unidad": "taza",
      "precio_normal": 11000,
      "escalas": [
        { "min": 10, "precio_unitario": 9000, "etiqueta": "10 a 24 pzas" },
        { "min": 25, "precio_unitario": 8000, "etiqueta": "25 a 49 pzas" },
        { "min": 50, "precio_unitario": 7200, "etiqueta": "50 a 99 pzas" },
        { "min": 100, "precio_unitario": 6500, "etiqueta": "100+ pzas" }
      ]
    },
    {
      "id": "kits",
      "nombre": "Kit corporativo (Playera + Termo o Taza + Stickers)",
      "unidad": "kit",
      "precio_normal": 42000,
      "escalas": [
        { "min": 10, "precio_unitario": 36500, "etiqueta": "10 a 24 kits" },
        { "min": 25, "precio_unitario": 34000, "etiqueta": "25 a 49 kits" },
        { "min": 50, "precio_unitario": 31500, "etiqueta": "50 a 99 kits" },
        { "min": 100, "precio_unitario": 29500, "etiqueta": "100+ kits" }
      ]
    }
  ]'::jsonb,
  '[
    {
      "pregunta": "¿Cuál es el pedido mínimo para precios de empresa?",
      "respuesta": "A partir de 10 piezas del mismo producto o paquete aplicamos tarifa corporativa. También puedes combinar tallas sin costo adicional dentro del mismo lote."
    },
    {
      "pregunta": "¿En qué formato debo enviar mi logotipo?",
      "respuesta": "De preferencia en PNG con fondo transparente, PDF editable, SVG o AI. Si solo tienes tu logo en JPG o captura, nuestro taller te ayuda a limpiarlo y prepararlo para impresión o grabado láser."
    },
    {
      "pregunta": "¿Cuánto tiempo tarda la producción de un lote empresarial?",
      "respuesta": "Un lote de 10 a 50 piezas toma entre 3 y 6 días hábiles a partir de la aprobación del mockup digital y el anticipo. Si tienes una fecha de evento urgente, indícala en el formulario para asignarte prioridad en taller."
    },
    {
      "pregunta": "¿Hacen envíos a todo México o entregas locales?",
      "respuesta": "Sí: puedes recoger sin costo en nuestro taller en Chiapas, pedir entrega a domicilio local o envío por paquetería nacional con número de guía rastreable."
    }
  ]'::jsonb
) on conflict (id) do nothing;

insert into public.b2b_packages (
  slug, nombre, subtitulo, descripcion, incluye, precio_desde, cantidad_minima, destacado, activo, orden
) values
  (
    'uniformes-equipo',
    'Pack Uniformes y Staff',
    'Identidad impecable para restaurantes, cafeterías, gimnasios y comercios',
    'Playeras y sudaderas de algodón con el logotipo de tu negocio al frente y gráfico o eslogan en espalda. Puedes mezclar tallas (CH a XXG) y colores dentro de tu lote.',
    array[
      'Playera 100% algodón peso completo con estampado de alta durabilidad',
      'Combinación libre de tallas sin mínimo por talla',
      'Mockup digital previo con tu logotipo en pecho y espalda',
      'Opción de agregar nombre individual por colaborador'
    ],
    13000,
    10,
    true,
    true,
    1
  ),
  (
    'kit-onboarding',
    'Kit Bienvenida / Onboarding',
    'Haz que cada nuevo integrante o cliente VIP recuerde su primer día',
    'Un paquete listo para entregar en escritorio o evento corporativo: combina textil, bebida térmica o cerámica y detalles personalizados con la identidad de tu empresa.',
    array[
      'Playera personalizada con el arte o logo de tu marca',
      'Termo grabado con láser o taza sublimada (con opción de nombre individual)',
      'Planilla de stickers en vinil de corte (Cricut) resistentes al agua',
      'Presentación cuidada lista para entregar'
    ],
    31500,
    10,
    true,
    true,
    2
  ),
  (
    'termos-grabado-laser',
    'Termos y Regalos Ejecutivos en Láser',
    'Un obsequio duradero que no se borra ni se despinta con el uso diario',
    'El grabado láser revela el acero inoxidable debajo del acabado mate, logrando un contraste elegante y permanente para clientes, socios, congresos o aniversarios.',
    array[
      'Grabado láser de precisión con tu logotipo institucional',
      'Posibilidad de personalizar cada pieza con el nombre del destinatario',
      'Acabado permanente que no se desprende con lavadas',
      'Empaque seguro para envío local o nacional'
    ],
    19000,
    10,
    false,
    true,
    3
  ),
  (
    'eventos-impresion-3d-promocionales',
    'Eventos, Expos y Piezas 3D / Láser',
    'Trofeos, llaveros, porta-reconocimientos, tazas y señalética para tu marca',
    'Fabricamos piezas únicas que no encuentras en catálogos genéricos: desde llaveros volumétricos en impresión 3D y reconocimientos en corte láser hasta tazas y mousepads sublimados.',
    array[
      'Diseño y modelado adaptado al isotipo de tu empresa',
      'Reconocimientos, llaveros 3D, tazas, playmats o vinil para stands',
      'Muestra digital antes de fabricar el tiraje completo',
      'Escalas de descuento progresivas según volumen'
    ],
    6500,
    15,
    false,
    true,
    4
  )
on conflict (slug) do nothing;

alter table public.wa_templates
  drop constraint if exists wa_templates_clave_check,
  add constraint wa_templates_clave_check check (clave ~ '^[a-z0-9_]+$');

insert into public.wa_templates (clave, nombre, cuerpo) values
  (
    'b2b_prospeccion_frio',
    'B2B · Prospección en frío',
    '¡Hola{{contacto}}! Te escribo de Taller Creativo.

Revisamos el perfil de *{{empresa}}* y preparamos una propuesta con opciones de uniformes, termos con grabado láser y kits corporativos personalizados con su marca, con simulador de precios por volumen:

{{link_empresas}}

{{nota_extra}}¿Tienen contemplado próximamente algún evento, renovación de uniformes o regalos corporativos para su equipo? Con gusto les preparamos una muestra digital previa sin costo para visualizar su logotipo.'
  ),
  (
    'b2b_prospeccion_seguimiento',
    'B2B · Seguimiento a empresa',
    '¡Hola{{contacto}}! Espero que te encuentres muy bien.

Dando seguimiento a nuestro contacto, ¿tuvieron oportunidad de revisar las opciones personalizadas para *{{empresa}}*?

{{link_empresas}}

Si nos compartes su logotipo por este medio, con gusto te preparamos una muestra digital previa sin compromiso para que puedan evaluarla. ¿Qué te parece?'
  ),
  (
    'b2b_cotizacion_nueva',
    'B2B · Solicitud desde /empresas',
    '¡Hola!
Acabo de registrar una solicitud de cotización empresarial con folio *{{folio}}*

Empresa: *{{empresa}}*
Contacto: {{nombre}}
Entrega: {{metodo_entrega}}

{{resumen}}

Quedo al pendiente de la propuesta y la muestra digital. ¡Gracias!'
  )
on conflict (clave) do nothing;

