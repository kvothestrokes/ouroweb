---
name: progreso
description: Registra avance en docs/OUROBOROS_ECOMMERCE.md al terminar una tarea, casilla o fase de Ouroboros — marca checklist, actualiza el estado de la fase y del documento y agrega una fila al registro de progreso. Úsala al completar algo o cuando pidan "actualiza el progreso".
---

# Actualizar el progreso

En `docs/OUROBOROS_ECOMMERCE.md`:

1. **Sección 12:** cambia `- [ ]` por `- [x]` en las casillas terminadas. No marques nada que no esté verificado (check, lint y test pasando; UI revisada).
2. **Encabezado de la fase:** ⬜ si no ha empezado, 🟡 si tiene casillas marcadas y pendientes, ✅ si todas están marcadas.
3. **Cabecera del documento:** actualiza "Última actualización" con la fecha de hoy y "Estado general" con la fase en curso.
4. **Sección 14:** agrega una fila `| AAAA-MM-DD | Fase N | qué se completó | notas o decisiones |`. Una fila por sesión de trabajo, no por archivo.
5. Si durante el trabajo se tomó una decisión nueva, agrégala a la sección 2; si apareció un dato de negocio pendiente, agrégalo a la sección 13.
6. Actualiza "Estado actual" en `CLAUDE.md` si cambió la fase.
