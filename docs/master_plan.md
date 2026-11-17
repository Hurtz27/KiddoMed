# HL KiddoMed — Plan Maestro y Registro de Decisiones

> **Documento vivo (Single Source of Truth):** Este archivo documenta la arquitectura, el modelo de datos, el alcance y las decisiones técnicas tomadas en **HL KiddoMed** hasta la fecha. Debe actualizarse en el mismo cambio cada vez que se tome una decisión arquitectónica, cambie el estado de una fase o se ajuste el alcance.

* **Proyecto:** HL KiddoMed (`hl-kiddomed`)
* **Versión actual:** `1.0.0`
* **Repositorio:** [Hurtz27/KiddoMed](https://github.com/Hurtz27/KiddoMed)
* **Última actualización:** 2026-11-16

---

## 1. Resumen Ejecutivo

**HL KiddoMed** es una aplicación móvil multiplataforma (iOS, Android y soporte web básico) orientada al seguimiento coordinado de salud y tratamientos médicos familiares (especialmente pediátricos). Permite a múltiples cuidadores (padres, abuelos, etc.) registrar enfermedades, tratamientos (medicamentos y cuidados), administrar dosis con **protección transaccional contra doble dosis**, monitorear fiebre/síntomas, recibir recordatorios locales y exportar resúmenes clínicos en PDF.

---

## 2. Decisiones Arquitectónicas (ADRs)

| Área | Decisión | Registro (ADR) |
|---|---|---|
| Stack Móvil y Navegación | Expo SDK 58 (`~58.0.25`) con CNG, Expo Router (`src/app/`), React Native `0.88.1` y tokens estilo Apple HIG | [ADR 0001](adr/0001-expo-sdk58-router-y-diseno-ios.md) |
| Backend, Auth y Seguridad | Firebase Auth (sesión anónima persistente) + Cloud Firestore (`/families/{familyId}/...`) con reglas por rol (`caregiver` / `patient`) en `firestore.rules` | [ADR 0002](adr/0002-firebase-firestore-y-auth-anonima.md) |
| Integridad de Dosis | Transacción atómica en Firestore (`runTransaction`) validando `min_safety_hours` antes de registrar una dosis | [ADR 0003](adr/0003-prevencion-doble-dosis-transaccional.md) |
| Offline, Alertas y Reportes | Caché de lectura por familia en `AsyncStorage`, recordatorios locales con `expo-notifications` y exportación PDF con `expo-print` + `expo-sharing` | [ADR 0004](adr/0004-cache-offline-notificaciones-y-pdf.md) |
| Multi-Familia, CRUD y Agenda | Soporte multi-familia en dispositivo, CRUD completo con borrado en cascada, reversión transaccional de dosis y agenda horaria de 7 días | [ADR 0005](adr/0005-multifamilia-crud-y-reversion-de-dosis.md) |

---

## 3. Modelo de Datos Confirmado (`src/types/database.ts`)

La estructura en Cloud Firestore se organiza bajo un árbol multi-tenant por familia:

* **`/invites/{inviteCode}`**: Códigos de invitación puntuales (`FAM-<NOMBRE>-<4_DIGITOS>`) para vincular nuevos dispositivos sin exponer listados (`allow list: if false`).
* **`/families/{familyId}`**: Documento raíz de la familia (`name`, `created_at`).
  * **`uid_roles/{uid}`**: Mapeo `uid -> { role: 'caregiver' | 'patient', member_id }` utilizado por `firestore.rules`.
  * **`members/{memberId}` (`FamilyMember`)**: Perfil del integrante (`display_name`, `relationship`, `birth_date`, `weight_kg`, `allergies[]`, `accent_color`, `has_app_access`, `access_role`, `invite_code`, `linked_uid`).
  * **`illnesses/{illnessId}` (`Illness`)**: Diagnósticos clínicos (`diagnosis`, `doctor_name`, `diagnosed_at`, `status: 'active' | 'resolved'`, `notes`, `created_by_name`).
  * **`treatments/{treatmentId}` (`TreatmentItem`)**: Elementos de tratamiento (`item_type: 'medication' | 'care'`, `brand_name`, `active_ingredients`, `dose_text`, `start_date`, `duration_days`, `end_date`, `frequency_type: 'hours' | 'days' | 'prn'`, `frequency_value`, `frequency_label`, `min_safety_hours`, `status: 'active' | 'completed' | 'suspended'`, `next_due_at`, `doses_administered_count`).
  * **`dose_logs/{logId}` (`DoseLog`)**: Bitácora **inmutable** de administraciones (`administered_at`, `administered_by_member_name`, `dose_text`, `was_early_override`, `notes`).
  * **`symptom_logs/{symptomId}` (`SymptomLog`)**: Registro de temperatura (`temperature_celsius`), `symptoms[]` y notas.

---

## 4. Estructura de Navegación y Módulos (`src/`)

* **Rutas (`src/app/`)**:
  * `_layout.tsx`: `NavigationGuard` con redirección automática a `/onboarding` si no hay `FamilySession` o a `/(tabs)` si la sesión está activa; incluye pantallas de detalle `member-illnesses.tsx` e `illness-detail.tsx`.
  * `onboarding.tsx`: Flujo de creación de familia o vinculación por código de invitación (`FamilyAccessForm`).
  * `(tabs)/`: Navegación principal en 5 pestañas:
    1. `index.tsx` (**Dosis**): Agenda horaria de 7 días por franjas de 30 min (`buildTreatmentSchedule`), `HeroDoseCard`, `SlotDoseModal` y selector de familia (`FamilySwitcherBar`).
    2. `notes.tsx` (**Notas**): Bitácora diaria de fiebre y síntomas con selector semanal (`WeekStrip`) y edición/eliminación.
    3. `patients.tsx` (**Miembros**): Gestión de integrantes (alta/edición/eliminación), alergias, peso, diagnósticos y exportación PDF.
    4. `history.tsx` (**Historial**): Búsqueda, consulta cronológica de dosis/síntomas y reversión de dosis erróneas.
    5. `settings.tsx` (**Familia**): Cambio/adición de múltiples familias, invitaciones, roles y gestión de sesión familiar.
  * `modals/`: `apply-dose.tsx`, `add-treatment.tsx`, `add-illness.tsx`, `add-symptom.tsx`, `add-member.tsx`, `add-family.tsx`.
* **Estado Global (`src/context/KiddoMedContext.tsx`)**: Soporte multi-familia (`families`, `addOrSelectFamily`, `switchFamily`, `leaveFamily`), suscripciones en tiempo real (`onSnapshot`), hidratación desde caché por familia (`kiddomed_v2_cache_<familyId>`), y reprogramación automática de recordatorios locales al cambiar `treatments` o `members`.
* **Servicios y Utilidades (`src/services/`, `src/utils/`)**: `kiddomed.ts` (CRUD completo, borrado en cascada por lotes y `revertDoseLogTransaction`), `cache.ts` (migración automática de sesión única a multi-familia), `notifications.ts`, `exportPdf.ts`, `formatting.ts` (`getTreatmentProgress`) y `schedule.ts` (`buildTreatmentSchedule`).
* **Sistema de Diseño (`src/theme/tokens.ts` y `src/components/`)**: Paleta y tipografía inspiradas en Apple HIG, `MEMBER_COLOR_PALETTE`, `FamilySwitcherBar`, `FamilyAccessForm`, `IllnessForm` y UI primitives (`Card`, `PillButton`, `StatusBanner`, `ChipGroup`, `FormField`, `GroupedListRow`, `HeroDoseCard`, `QuickActionTile`, `SegmentedControl`, `SlotDoseModal`, `WeekStrip`).

---

## 5. Alcance Actual (V1)

### Incluido en V1
- [x] Arquitectura Expo SDK 58 + Expo Router + TypeScript con generación nativa continua (CNG, sin `ios/` ni `android/` manuales), enfocada a `ios` y `android`.
- [x] Configuración de builds y canales OTA en `eas.json` (`development`, `preview` APK, `production`) y proyecto EAS vinculado en `app.json` (`hurtz27`).
- [x] Autenticación anónima Firebase, vinculación familiar por código de invitación (`FAM-...`) y soporte multi-familia en dispositivo.
- [x] Reglas de seguridad Firestore (`firestore.rules`) con control por rol (`caregiver` / `patient`) y soporte `existsAfter`/`getAfter` para batches atómicos.
- [x] Prevención transaccional de doble dosis (`min_safety_hours`) con confirmación explícita de excepción (`was_early_override`) y reversión transaccional de dosis erróneas (`revertDoseLogTransaction`).
- [x] Gestión completa (alta, edición y eliminación en cascada) de miembros, enfermedades, tratamientos y síntomas.
- [x] Agenda horaria de 7 días por franjas de 30 minutos (`buildTreatmentSchedule`) y pestaña dedicada de `Notas`.
- [x] Caché de lectura offline por familia en `AsyncStorage` y reprogramación local de notificaciones (`expo-notifications`).
- [x] Exportación de resumen clínico en PDF (`expo-print` + `expo-sharing`).

### Explícitamente Excluido de V1 (Fuera de Alcance Actual)
- Edición libre de registros históricos en `dose_logs` por parte de rol `patient` (solo `caregiver` puede revertir una dosis errónea vía `revertDoseLogTransaction`).
- Notificaciones push remotas (FCM/APNs) entre dispositivos cuando la app está cerrada (actualmente son recordatorios locales programados en cada dispositivo sincronizado).
- Autenticación con correo/contraseña, Apple Sign-In o Google Sign-In (actualmente se usa Auth Anónima + códigos de invitación).
- Integración con catálogos externos de medicamentos o cálculo automático de dosis por peso.

---

## 6. Estado de Fases y Verificación

| Fase | Estado | Notas |
|---|---|---|
| 1. Fundación Expo + Diseño UI + Modelo de Datos | `COMPLETED` | Base funcional implementada en `src/` |
| 2. Integración Firebase + Reglas + Caché/Notificaciones/PDF | `COMPLETED` | Implementado en `src/services/` y `firestore.rules` |
| 3. Multi-Familia, CRUD Completo, Agenda Horaria y Notas | `COMPLETED` | Implementado con `npx tsc --noEmit` y `npx expo lint` en verde |
| 4. Documentación Viva y Control de Versiones (Git/GitHub) | `COMPLETED` | `docs/master_plan.md` y ADRs `0001`–`0005` actualizados y subidos a `Hurtz27/KiddoMed` |
| 5. Validación en Dispositivo / Builds EAS (`preview` / `production`) | `PENDING` | Pendiente de pruebas end-to-end en dispositivo físico y despliegue de `firestore.rules` |

---

## 7. Decisiones Abiertas / Próximos Pasos

- Desplegar `firestore.rules` (raíz) en el proyecto Firebase configurado en `.env` y unificar/eliminar la copia legada en `firebase/firestore.rules` si ya no se utiliza.
- Ejecutar pruebas en dispositivo físico mediante `eas build --profile development` o `preview`.
- Evaluar si en V2 se requerirá recuperación de cuenta familiar vía email/OAuth en caso de pérdida de todos los dispositivos vinculados.

---

## 8. Registro de Cambios (Change Log)

| Fecha | Cambio | Decidido por |
|---|---|---|
| 2026-11-16 | Creación inicial de `docs/master_plan.md` y ADRs `0001`–`0004` documentando todas las decisiones arquitectónicas y de producto tomadas hasta la fecha. | Usuario + Asistente |
| 2026-11-16 | Actualización de `docs/master_plan.md` y creación de ADR `0005` documentando soporte multi-familia, CRUD completo con borrado en cascada, reversión de dosis, agenda de 7 días, pestaña `Notas`, `firestore.rules` en raíz y configuración EAS (`app.json`/`eas.json`). | Usuario + Asistente |
