# 0001. Stack Móvil con Expo SDK 58, Expo Router y Diseño Apple HIG

* **Date:** 2026-11-16
* **Status:** Accepted
* **Deciders:** Usuario, Asistente IA

## Context
Se requiere una aplicación móvil multiplataforma (iOS y Android, con soporte web secundario) para gestión clínica familiar, priorizando velocidad de iteración, mantenimiento sencillo sin gestionar proyectos nativos manualmente (`ios/` y `android/`), y una interfaz clara y confiable para cuidadores en situaciones de estrés (p. ej. fiebre nocturna).

## Decision
1. **Expo SDK 58 (`~58.0.25`) con Continuous Native Generation (CNG):** La configuración nativa vive en `app.json` y `eas.json`, evitando editar carpetas `ios/` o `android/` a mano.
2. **Expo Router (`src/app/`):** Enrutamiento basado en archivos con 4 pestañas principales (`(tabs)/`) y pantallas modales dedicadas (`modals/`) protegidas por `NavigationGuard` en `src/app/_layout.tsx`.
3. **Sistema de diseño inspirado en Apple HIG (`src/theme/tokens.ts`):** Superficies agrupadas (`#F2F2F7` / `#FFFFFF`), tipografía con `tabular-nums` para horarios/dosis y componentes base reutilizables (`Card`, `PillButton`, `StatusBanner`).

## Consequences
- **Positive:** Compilación en la nube con EAS (`development`, `preview` APK, `production`), tipado estricto en rutas (`typedRoutes: true`) y experiencia visual consistente y legible.
- **Trade-offs & Risks:** Cualquier dependencia con código nativo nuevo requiere reconstruir el *development client* (no basta con Expo Go).
