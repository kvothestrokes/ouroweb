export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	// Allows to automatically instantiate createClient with right options
	// instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
	__InternalSupabase: {
		PostgrestVersion: '14.18';
	};
	graphql_public: {
		Tables: {
			[_ in never]: never;
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			graphql: {
				Args: {
					extensions?: Json;
					operationName?: string;
					query?: string;
					variables?: Json;
				};
				Returns: Json;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	public: {
		Tables: {
			categories: {
				Row: {
					activo: boolean;
					created_at: string;
					es_estrella: boolean;
					id: string;
					imagen_hero: string | null;
					nombre: string;
					orden: number;
					parent_id: string | null;
					slug: string;
				};
				Insert: {
					activo?: boolean;
					created_at?: string;
					es_estrella?: boolean;
					id?: string;
					imagen_hero?: string | null;
					nombre: string;
					orden?: number;
					parent_id?: string | null;
					slug: string;
				};
				Update: {
					activo?: boolean;
					created_at?: string;
					es_estrella?: boolean;
					id?: string;
					imagen_hero?: string | null;
					nombre?: string;
					orden?: number;
					parent_id?: string | null;
					slug?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'categories_parent_id_fkey';
						columns: ['parent_id'];
						isOneToOne: false;
						referencedRelation: 'categories';
						referencedColumns: ['id'];
					}
				];
			};
			collections: {
				Row: {
					created_at: string;
					id: string;
					imagen: string | null;
					nombre: string;
					slug: string;
				};
				Insert: {
					created_at?: string;
					id?: string;
					imagen?: string | null;
					nombre: string;
					slug: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					imagen?: string | null;
					nombre?: string;
					slug?: string;
				};
				Relationships: [];
			};
			coupons: {
				Row: {
					codigo: string;
					created_at: string;
					id: string;
					minimo: number;
					tipo: Database['public']['Enums']['coupon_type'];
					usos: number;
					usos_max: number | null;
					valor: number;
					vigente_desde: string | null;
					vigente_hasta: string | null;
				};
				Insert: {
					codigo: string;
					created_at?: string;
					id?: string;
					minimo?: number;
					tipo: Database['public']['Enums']['coupon_type'];
					usos?: number;
					usos_max?: number | null;
					valor: number;
					vigente_desde?: string | null;
					vigente_hasta?: string | null;
				};
				Update: {
					codigo?: string;
					created_at?: string;
					id?: string;
					minimo?: number;
					tipo?: Database['public']['Enums']['coupon_type'];
					usos?: number;
					usos_max?: number | null;
					valor?: number;
					vigente_desde?: string | null;
					vigente_hasta?: string | null;
				};
				Relationships: [];
			};
			custom_request_types: {
				Row: {
					activo: boolean;
					created_at: string;
					id: string;
					nombre: string;
					precio_desde: number | null;
				};
				Insert: {
					activo?: boolean;
					created_at?: string;
					id?: string;
					nombre: string;
					precio_desde?: number | null;
				};
				Update: {
					activo?: boolean;
					created_at?: string;
					id?: string;
					nombre?: string;
					precio_desde?: number | null;
				};
				Relationships: [];
			};
			custom_requests: {
				Row: {
					archivos_referencia: string[];
					cantidad: number;
					custom_request_type_id: string | null;
					descripcion: string;
					fecha_deseada: string | null;
					id: string;
					order_id: string;
					precio_final: number | null;
				};
				Insert: {
					archivos_referencia?: string[];
					cantidad?: number;
					custom_request_type_id?: string | null;
					descripcion: string;
					fecha_deseada?: string | null;
					id?: string;
					order_id: string;
					precio_final?: number | null;
				};
				Update: {
					archivos_referencia?: string[];
					cantidad?: number;
					custom_request_type_id?: string | null;
					descripcion?: string;
					fecha_deseada?: string | null;
					id?: string;
					order_id?: string;
					precio_final?: number | null;
				};
				Relationships: [
					{
						foreignKeyName: 'custom_requests_custom_request_type_id_fkey';
						columns: ['custom_request_type_id'];
						isOneToOne: false;
						referencedRelation: 'custom_request_types';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'custom_requests_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: true;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					}
				];
			};
			designs: {
				Row: {
					created_at: string;
					id: string;
					nombre: string;
					path_prenda_clara: string | null;
					path_prenda_oscura: string | null;
				};
				Insert: {
					created_at?: string;
					id?: string;
					nombre: string;
					path_prenda_clara?: string | null;
					path_prenda_oscura?: string | null;
				};
				Update: {
					created_at?: string;
					id?: string;
					nombre?: string;
					path_prenda_clara?: string | null;
					path_prenda_oscura?: string | null;
				};
				Relationships: [];
			};
			folio_counters: {
				Row: {
					periodo: string;
					ultimo_numero: number;
				};
				Insert: {
					periodo: string;
					ultimo_numero?: number;
				};
				Update: {
					periodo?: string;
					ultimo_numero?: number;
				};
				Relationships: [];
			};
			gallery_items: {
				Row: {
					collection_id: string | null;
					created_at: string;
					id: string;
					imagekit_path: string;
					orden: number;
					titulo: string;
				};
				Insert: {
					collection_id?: string | null;
					created_at?: string;
					id?: string;
					imagekit_path: string;
					orden?: number;
					titulo?: string;
				};
				Update: {
					collection_id?: string | null;
					created_at?: string;
					id?: string;
					imagekit_path?: string;
					orden?: number;
					titulo?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'gallery_items_collection_id_fkey';
						columns: ['collection_id'];
						isOneToOne: false;
						referencedRelation: 'collections';
						referencedColumns: ['id'];
					}
				];
			};
			garment_bases: {
				Row: {
					area_impresion: Json;
					color_hex: string;
					color_nombre: string;
					created_at: string;
					es_clara: boolean;
					foto: string;
					garment_type_id: string;
					id: string;
				};
				Insert: {
					area_impresion: Json;
					color_hex: string;
					color_nombre: string;
					created_at?: string;
					es_clara?: boolean;
					foto: string;
					garment_type_id: string;
					id?: string;
				};
				Update: {
					area_impresion?: Json;
					color_hex?: string;
					color_nombre?: string;
					created_at?: string;
					es_clara?: boolean;
					foto?: string;
					garment_type_id?: string;
					id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'garment_bases_garment_type_id_fkey';
						columns: ['garment_type_id'];
						isOneToOne: false;
						referencedRelation: 'garment_types';
						referencedColumns: ['id'];
					}
				];
			};
			garment_types: {
				Row: {
					created_at: string;
					guia_tallas: Json;
					id: string;
					mayoreo_cantidad_min: number | null;
					nombre: string;
					precio_mayoreo: number | null;
					precio_normal: number | null;
					recargos_talla: Json;
					tallas: string[];
				};
				Insert: {
					created_at?: string;
					guia_tallas?: Json;
					id?: string;
					mayoreo_cantidad_min?: number | null;
					nombre: string;
					precio_mayoreo?: number | null;
					precio_normal?: number | null;
					recargos_talla?: Json;
					tallas?: string[];
				};
				Update: {
					created_at?: string;
					guia_tallas?: Json;
					id?: string;
					mayoreo_cantidad_min?: number | null;
					nombre?: string;
					precio_mayoreo?: number | null;
					precio_normal?: number | null;
					recargos_talla?: Json;
					tallas?: string[];
				};
				Relationships: [];
			};
			order_events: {
				Row: {
					estado: Database['public']['Enums']['order_status'];
					fecha: string;
					id: string;
					nota: string | null;
					order_id: string;
				};
				Insert: {
					estado: Database['public']['Enums']['order_status'];
					fecha?: string;
					id?: string;
					nota?: string | null;
					order_id: string;
				};
				Update: {
					estado?: Database['public']['Enums']['order_status'];
					fecha?: string;
					id?: string;
					nota?: string | null;
					order_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'order_events_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: false;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					}
				];
			};
			order_files: {
				Row: {
					created_at: string;
					descripcion: string | null;
					id: string;
					imagekit_path: string;
					order_id: string;
				};
				Insert: {
					created_at?: string;
					descripcion?: string | null;
					id?: string;
					imagekit_path: string;
					order_id: string;
				};
				Update: {
					created_at?: string;
					descripcion?: string | null;
					id?: string;
					imagekit_path?: string;
					order_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'order_files_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: false;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					}
				];
			};
			order_items: {
				Row: {
					cantidad: number;
					color: string | null;
					id: string;
					nombre_snapshot: string;
					order_id: string;
					personalizacion_archivo: string | null;
					personalizacion_texto: string | null;
					precio_unitario: number;
					product_id: string | null;
					recargo_talla: number;
					talla: string | null;
				};
				Insert: {
					cantidad: number;
					color?: string | null;
					id?: string;
					nombre_snapshot: string;
					order_id: string;
					personalizacion_archivo?: string | null;
					personalizacion_texto?: string | null;
					precio_unitario: number;
					product_id?: string | null;
					recargo_talla?: number;
					talla?: string | null;
				};
				Update: {
					cantidad?: number;
					color?: string | null;
					id?: string;
					nombre_snapshot?: string;
					order_id?: string;
					personalizacion_archivo?: string | null;
					personalizacion_texto?: string | null;
					precio_unitario?: number;
					product_id?: string | null;
					recargo_talla?: number;
					talla?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'order_items_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: false;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'order_items_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['id'];
					}
				];
			};
			order_notes: {
				Row: {
					fecha: string;
					id: string;
					order_id: string;
					texto: string;
				};
				Insert: {
					fecha?: string;
					id?: string;
					order_id: string;
					texto: string;
				};
				Update: {
					fecha?: string;
					id?: string;
					order_id?: string;
					texto?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'order_notes_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: false;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					}
				];
			};
			orders: {
				Row: {
					anticipo_requerido: number | null;
					cliente_nombre: string;
					cliente_whatsapp: string;
					coupon_id: string | null;
					created_at: string;
					desc_cupon: number;
					desc_mayoreo: number;
					direccion: Json | null;
					envio: number | null;
					estado: Database['public']['Enums']['order_status'];
					folio: string;
					guia: string | null;
					id: string;
					metodo_entrega: Database['public']['Enums']['delivery_method'];
					notas_cliente: string;
					personalizacion: number | null;
					subtotal: number;
					tipo: Database['public']['Enums']['order_type'];
					total: number;
					updated_at: string;
				};
				Insert: {
					anticipo_requerido?: number | null;
					cliente_nombre: string;
					cliente_whatsapp: string;
					coupon_id?: string | null;
					created_at?: string;
					desc_cupon?: number;
					desc_mayoreo?: number;
					direccion?: Json | null;
					envio?: number | null;
					estado?: Database['public']['Enums']['order_status'];
					folio: string;
					guia?: string | null;
					id?: string;
					metodo_entrega: Database['public']['Enums']['delivery_method'];
					notas_cliente?: string;
					personalizacion?: number | null;
					subtotal: number;
					tipo: Database['public']['Enums']['order_type'];
					total: number;
					updated_at?: string;
				};
				Update: {
					anticipo_requerido?: number | null;
					cliente_nombre?: string;
					cliente_whatsapp?: string;
					coupon_id?: string | null;
					created_at?: string;
					desc_cupon?: number;
					desc_mayoreo?: number;
					direccion?: Json | null;
					envio?: number | null;
					estado?: Database['public']['Enums']['order_status'];
					folio?: string;
					guia?: string | null;
					id?: string;
					metodo_entrega?: Database['public']['Enums']['delivery_method'];
					notas_cliente?: string;
					personalizacion?: number | null;
					subtotal?: number;
					tipo?: Database['public']['Enums']['order_type'];
					total?: number;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'orders_coupon_id_fkey';
						columns: ['coupon_id'];
						isOneToOne: false;
						referencedRelation: 'coupons';
						referencedColumns: ['id'];
					}
				];
			};
			payments: {
				Row: {
					comprobante_path: string | null;
					fecha: string;
					id: string;
					metodo: string;
					monto: number;
					order_id: string;
					tipo: Database['public']['Enums']['payment_type'];
				};
				Insert: {
					comprobante_path?: string | null;
					fecha?: string;
					id?: string;
					metodo: string;
					monto: number;
					order_id: string;
					tipo: Database['public']['Enums']['payment_type'];
				};
				Update: {
					comprobante_path?: string | null;
					fecha?: string;
					id?: string;
					metodo?: string;
					monto?: number;
					order_id?: string;
					tipo?: Database['public']['Enums']['payment_type'];
				};
				Relationships: [
					{
						foreignKeyName: 'payments_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: false;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					}
				];
			};
			product_collections: {
				Row: {
					collection_id: string;
					product_id: string;
				};
				Insert: {
					collection_id: string;
					product_id: string;
				};
				Update: {
					collection_id?: string;
					product_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'product_collections_collection_id_fkey';
						columns: ['collection_id'];
						isOneToOne: false;
						referencedRelation: 'collections';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'product_collections_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['id'];
					}
				];
			};
			product_colors: {
				Row: {
					garment_base_id: string;
					product_id: string;
				};
				Insert: {
					garment_base_id: string;
					product_id: string;
				};
				Update: {
					garment_base_id?: string;
					product_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'product_colors_garment_base_id_fkey';
						columns: ['garment_base_id'];
						isOneToOne: false;
						referencedRelation: 'garment_bases';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'product_colors_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['id'];
					}
				];
			};
			product_images: {
				Row: {
					created_at: string;
					id: string;
					imagekit_path: string;
					orden: number;
					product_id: string;
				};
				Insert: {
					created_at?: string;
					id?: string;
					imagekit_path: string;
					orden?: number;
					product_id: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					imagekit_path?: string;
					orden?: number;
					product_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'product_images_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['id'];
					}
				];
			};
			product_stock: {
				Row: {
					cantidad: number;
					garment_base_id: string;
					product_id: string;
					talla: string;
				};
				Insert: {
					cantidad?: number;
					garment_base_id: string;
					product_id: string;
					talla: string;
				};
				Update: {
					cantidad?: number;
					garment_base_id?: string;
					product_id?: string;
					talla?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'product_stock_garment_base_id_fkey';
						columns: ['garment_base_id'];
						isOneToOne: false;
						referencedRelation: 'garment_bases';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'product_stock_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['id'];
					}
				];
			};
			products: {
				Row: {
					activo: boolean;
					category_id: string;
					created_at: string;
					descripcion: string;
					design_id: string | null;
					destacado: boolean;
					garment_type_id: string | null;
					id: string;
					modo_stock: Database['public']['Enums']['stock_mode'];
					nombre: string;
					permite_personalizar: boolean;
					precio_base: number | null;
					slug: string;
					tipo_imagen: Database['public']['Enums']['image_type'];
					updated_at: string;
				};
				Insert: {
					activo?: boolean;
					category_id: string;
					created_at?: string;
					descripcion?: string;
					design_id?: string | null;
					destacado?: boolean;
					garment_type_id?: string | null;
					id?: string;
					modo_stock?: Database['public']['Enums']['stock_mode'];
					nombre: string;
					permite_personalizar?: boolean;
					precio_base?: number | null;
					slug: string;
					tipo_imagen: Database['public']['Enums']['image_type'];
					updated_at?: string;
				};
				Update: {
					activo?: boolean;
					category_id?: string;
					created_at?: string;
					descripcion?: string;
					design_id?: string | null;
					destacado?: boolean;
					garment_type_id?: string | null;
					id?: string;
					modo_stock?: Database['public']['Enums']['stock_mode'];
					nombre?: string;
					permite_personalizar?: boolean;
					precio_base?: number | null;
					slug?: string;
					tipo_imagen?: Database['public']['Enums']['image_type'];
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'products_category_id_fkey';
						columns: ['category_id'];
						isOneToOne: false;
						referencedRelation: 'categories';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'products_design_id_fkey';
						columns: ['design_id'];
						isOneToOne: false;
						referencedRelation: 'designs';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'products_garment_type_id_fkey';
						columns: ['garment_type_id'];
						isOneToOne: false;
						referencedRelation: 'garment_types';
						referencedColumns: ['id'];
					}
				];
			};
			reviews: {
				Row: {
					aprobada: boolean;
					calificacion: number;
					created_at: string;
					foto_path: string | null;
					id: string;
					order_id: string;
					product_id: string | null;
					texto: string;
				};
				Insert: {
					aprobada?: boolean;
					calificacion: number;
					created_at?: string;
					foto_path?: string | null;
					id?: string;
					order_id: string;
					product_id?: string | null;
					texto?: string;
				};
				Update: {
					aprobada?: boolean;
					calificacion?: number;
					created_at?: string;
					foto_path?: string | null;
					id?: string;
					order_id?: string;
					product_id?: string | null;
					texto?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'reviews_order_id_fkey';
						columns: ['order_id'];
						isOneToOne: false;
						referencedRelation: 'orders';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'reviews_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['id'];
					}
				];
			};
			settings: {
				Row: {
					anticipo_sugerido_pct: number;
					datos_bancarios: string;
					direccion_taller: string;
					horarios: string;
					id: boolean;
					updated_at: string;
					whatsapp_negocio: string;
				};
				Insert: {
					anticipo_sugerido_pct?: number;
					datos_bancarios?: string;
					direccion_taller?: string;
					horarios?: string;
					id?: boolean;
					updated_at?: string;
					whatsapp_negocio: string;
				};
				Update: {
					anticipo_sugerido_pct?: number;
					datos_bancarios?: string;
					direccion_taller?: string;
					horarios?: string;
					id?: boolean;
					updated_at?: string;
					whatsapp_negocio?: string;
				};
				Relationships: [];
			};
			volume_pricing: {
				Row: {
					cantidad_min: number;
					category_id: string | null;
					descuento_pct: number;
					id: string;
					product_id: string | null;
				};
				Insert: {
					cantidad_min: number;
					category_id?: string | null;
					descuento_pct: number;
					id?: string;
					product_id?: string | null;
				};
				Update: {
					cantidad_min?: number;
					category_id?: string | null;
					descuento_pct?: number;
					id?: string;
					product_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'volume_pricing_category_id_fkey';
						columns: ['category_id'];
						isOneToOne: false;
						referencedRelation: 'categories';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'volume_pricing_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['id'];
					}
				];
			};
			wa_templates: {
				Row: {
					clave: string;
					cuerpo: string;
					nombre: string;
					updated_at: string;
				};
				Insert: {
					clave: string;
					cuerpo: string;
					nombre: string;
					updated_at?: string;
				};
				Update: {
					clave?: string;
					cuerpo?: string;
					nombre?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			category_is_public: { Args: { p_category_id: string }; Returns: boolean };
			create_custom_order: {
				Args: { p_fecha?: string; p_order: Json; p_request: Json };
				Returns: string;
			};
			create_order: {
				Args: { p_fecha?: string; p_items: Json; p_order: Json };
				Returns: string;
			};
			guard_new_order: { Args: { p_whatsapp: string }; Returns: undefined };
			is_admin: { Args: never; Returns: boolean };
			next_folio: {
				Args: { p_fecha?: string; p_prefijo?: string };
				Returns: string;
			};
			save_product: {
				Args: {
					p_collections: string[];
					p_colors: string[];
					p_id: string;
					p_product: Json;
					p_stock: Json;
				};
				Returns: string;
			};
		};
		Enums: {
			coupon_type: 'porcentaje' | 'fijo';
			delivery_method: 'recoger' | 'domicilio' | 'paqueteria';
			image_type: 'mockup' | 'foto';
			order_status:
				| 'pendiente'
				| 'esperando_anticipo'
				| 'confirmado'
				| 'en_produccion'
				| 'listo'
				| 'enviado'
				| 'listo_para_recoger'
				| 'entregado'
				| 'cancelado';
			order_type: 'catalogo' | 'encargo';
			payment_type: 'anticipo' | 'abono' | 'liquidacion';
			stock_mode: 'stock' | 'bajo_pedido';
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never) = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never) = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never) = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
	EnumName extends (DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never) = never
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never) = never
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	graphql_public: {
		Enums: {}
	},
	public: {
		Enums: {
			coupon_type: ['porcentaje', 'fijo'],
			delivery_method: ['recoger', 'domicilio', 'paqueteria'],
			image_type: ['mockup', 'foto'],
			order_status: [
				'pendiente',
				'esperando_anticipo',
				'confirmado',
				'en_produccion',
				'listo',
				'enviado',
				'listo_para_recoger',
				'entregado',
				'cancelado'
			],
			order_type: ['catalogo', 'encargo'],
			payment_type: ['anticipo', 'abono', 'liquidacion'],
			stock_mode: ['stock', 'bajo_pedido']
		}
	}
} as const;
