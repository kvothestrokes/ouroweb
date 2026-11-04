-- Ouroboros: Actualización de plantillas de WhatsApp sin caracteres especiales ni mención innecesaria de marca.

update public.wa_templates set cuerpo =
$t$¡Hola!
Acabo de hacer mi pedido *{{folio}}*

Cliente: {{nombre}}
Entrega: {{metodo_entrega}}

{{resumen}}

Subtotal: {{subtotal}}
Envío y personalización: Por cotizar

Quedo al pendiente de la cotización final y los datos para el anticipo. ¡Gracias!$t$
where clave = 'pedido_nuevo';

update public.wa_templates set cuerpo =
$t$¡Hola!
Acabo de enviar mi encargo especial *{{folio}}*

Cliente: {{nombre}}
Entrega: {{metodo_entrega}}

{{resumen}}

Quedo al pendiente de la cotización. ¡Gracias!$t$
where clave = 'encargo_nuevo';

update public.wa_templates set cuerpo =
$t$¡Hola, {{nombre}}! Gracias por tu pedido *{{folio}}*.

Total: {{total}} (incluye envío: {{envio}})
Para iniciar la producción requerimos un anticipo de *{{anticipo}}*.

{{datos_bancarios}}

Por favor envíanos tu comprobante por este medio para comenzar.
Seguimiento de tu pedido: {{link_seguimiento}}$t$
where clave = 'cotizacion_anticipo';

update public.wa_templates set cuerpo =
$t$¡Hola, {{nombre}}! Recibimos tu anticipo de {{pagado}} para el pedido *{{folio}}*.

Tu pedido está confirmado. Saldo pendiente: {{saldo}}.
Seguimiento de tu pedido: {{link_seguimiento}}$t$
where clave = 'anticipo_recibido';

update public.wa_templates set cuerpo =
$t$¡Hola, {{nombre}}! Tu pedido *{{folio}}* ya se encuentra en producción.

Te avisaremos en cuanto esté listo.
Seguimiento de tu pedido: {{link_seguimiento}}$t$
where clave = 'en_produccion';

update public.wa_templates set cuerpo =
$t$¡Hola, {{nombre}}! Tu pedido *{{folio}}* está listo para ser recogido en el taller.

Dirección de entrega:
{{direccion_taller}}

Saldo pendiente: {{saldo}}

¡Te esperamos!$t$
where clave = 'listo_recoger';

update public.wa_templates set cuerpo =
$t$¡Hola, {{nombre}}! Tu pedido *{{folio}}* ya va en camino.

Número de guía de envío: {{guia}}
Seguimiento de tu pedido: {{link_seguimiento}}$t$
where clave = 'enviado';

update public.wa_templates set cuerpo =
$t$¡Hola, {{nombre}}! Tu pedido *{{folio}}* ha sido entregado. Muchas gracias por tu compra.

Nos encantaría conocer tu opinión. Puedes dejarnos tu reseña aquí: {{link_seguimiento}}$t$
where clave = 'entregado_resena';

update public.wa_templates set cuerpo =
$t$Hola, {{nombre}}. Tu pedido *{{folio}}* ha sido cancelado.

Motivo: {{motivo}}
Si tienes alguna duda o deseas realizar un nuevo pedido, con gusto te atendemos por este medio.$t$
where clave = 'cancelado';

update public.wa_templates set cuerpo =
$t$¡Hola{{contacto}}! Te escribo de Taller Creativo.

Revisamos el perfil de *{{empresa}}* y preparamos una propuesta con opciones de uniformes, termos con grabado láser y kits corporativos personalizados con su marca, con simulador de precios por volumen:

{{link_empresas}}

{{nota_extra}}¿Tienen contemplado próximamente algún evento, renovación de uniformes o regalos corporativos para su equipo? Con gusto les preparamos una muestra digital previa sin costo para visualizar su logotipo.$t$
where clave = 'b2b_prospeccion_frio';

update public.wa_templates set cuerpo =
$t$¡Hola{{contacto}}! Espero que te encuentres muy bien.

Dando seguimiento a nuestro contacto, ¿tuvieron oportunidad de revisar las opciones personalizadas para *{{empresa}}*?

{{link_empresas}}

Si nos compartes su logotipo por este medio, con gusto te preparamos una muestra digital previa sin compromiso para que puedan evaluarla. ¿Qué te parece?$t$
where clave = 'b2b_prospeccion_seguimiento';

update public.wa_templates set cuerpo =
$t$¡Hola!
Acabo de registrar una solicitud de cotización empresarial con folio *{{folio}}*

Empresa: *{{empresa}}*
Contacto: {{nombre}}
Entrega: {{metodo_entrega}}

{{resumen}}

Quedo al pendiente de la propuesta y la muestra digital. ¡Gracias!$t$
where clave = 'b2b_cotizacion_nueva';
