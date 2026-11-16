# 0004. Caché Local de Lectura, Notificaciones Locales y Exportación PDF

* **Date:** 2026-11-16
* **Status:** Accepted
* **Deciders:** Usuario, Asistente IA

## Context
La app debe mostrar la información clínica incluso si el dispositivo pierde temporalmente conexión, avisar al cuidador cuando corresponde la siguiente dosis y permitir compartir un resumen legible con el pediatra o médico tratante.

## Decision
1. **Caché de lectura (`src/services/cache.ts`):** Persistir la sesión (`kiddomed_v2_session`) y la última instantánea de datos (`kiddomed_v2_cache`) en `AsyncStorage` para hidratación instantánea al abrir la app.
2. **Notificaciones locales (`src/services/notifications.ts`):** Programar recordatorios locales por tratamiento activo con `expo-notifications` (canal Android `medications_high` de importancia 5), guardando el mapa `prescriptionId -> notificationId` en `AsyncStorage` (`kiddomed_notification_ids_v1`) para cancelar o reprogramar automáticamente desde `KiddoMedContext`.
3. **Exportación PDF (`src/services/exportPdf.ts`):** Generar HTML clínico (alergias, diagnósticos, dosis y síntomas) y convertirlo/compartirlo nativamente mediante `expo-print` y `expo-sharing`.

## Consequences
- **Positive:** Arranque inmediato sin pantallas en blanco, alertas locales sin depender de un servidor push propio y reportes listos para consulta médica.
- **Trade-offs & Risks:** Las notificaciones son locales por dispositivo (dependen de que la app haya sincronizado el último `next_due_at`), y en plataforma `web` las notificaciones quedan deshabilitadas de forma segura.
