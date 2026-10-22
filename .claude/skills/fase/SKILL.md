---
name: fase
description: Arranca o continúa una fase del roadmap de Ouroboros (docs/OUROBOROS_ECOMMERCE.md, sección 12). Úsala cuando digan "arranquemos la fase N", "sigamos con la fase", "¿qué sigue?" o "¿en qué vamos?".
---

# Trabajar una fase del roadmap

1. Abre `docs/OUROBOROS_ECOMMERCE.md`, sección 12. Identifica la fase pedida (o la primera que no esté ✅) y sus casillas pendientes.
2. Resume en pocas líneas: qué falta de la fase, en qué orden lo harás y qué pendientes de negocio (sección 13) bloquean algo. Si hay un bloqueo, usa placeholders `TODO(negocio):` y sigue.
3. Marca la fase como 🟡 en su encabezado.
4. Trabaja casilla por casilla siguiendo el "Flujo de trabajo por tarea" de `CLAUDE.md`. Al terminar cada una, usa la skill `progreso`.
5. Al cerrar la fase: pide al agente `revisor-seguridad` (y a `revisor-ui` si hubo pantallas) que revise; corrige lo que encuentren; marca la fase ✅.

## Notas para la Fase 0

- El kit ya trae `CLAUDE.md`, `.claude/`, `.mcp.json`, `docs/`, `setup/` y archivos de configuración. Crea el proyecto SvelteKit **en la carpeta actual** sin borrarlos: si `npx sv create .` se queja de carpeta no vacía, créalo en una carpeta temporal y mueve los archivos generados, fusionando `.gitignore` y `.prettierrc` en lugar de sobrescribirlos.
- Opciones de `sv create`: plantilla mínima, TypeScript; add-ons: prettier, eslint, vitest, tailwindcss, sveltekit-adapter (vercel).
- Después: `npx shadcn-svelte@latest init`, fusiona `setup/app.css` en `src/app.css`, instala `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `lucide-svelte` y el SDK de Node de ImageKit (confirma el nombre del paquete vigente en su documentación).
- Los dos spikes de ImageKit (overlay privado en URL firmada; expiración fija y caché) se hacen con un script o ruta temporal y su resultado se documenta en la skill `ouroboros-imagekit`.
