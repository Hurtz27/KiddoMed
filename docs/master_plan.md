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
| Backend, Auth y Seguridad | Firebase Auth (sesión anónima persistente) + Cloud Firestore (`/families/{familyId}/...`) con reglas por rol (`caregiver` / `patient`) e `dose_logs` inmutables | [ADR 0002](adr/0002-firebase-firestore-y-auth-anonima.md) |
| Integridad de Dosis | Transacción atómica en Firestore (`runTransaction`) validando `min_safety_hours` antes de registrar una dosis | [ADR 0003](adr/0003-prevencion-doble-dosis-transaccional.md) |
| Offline, Alertas y Reportes | Caché de lectura en `AsyncStorage`, recordatorios locales con `expo-notifications` y exportación PDF con `expo-print` + `expo-sharing` | [ADR 0004](adr/0004-cache-offline-notificaciones-y-pdf.md) |

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
  * `_layout.tsx`: `NavigationGuard` con redirección automática a `/onboarding` si no hay `FamilySession` o a `/(tabs)` si la sesión está activa.
  * `onboarding.tsx`: Flujo de creación de familia o vinculación por código de invitación.
  * `(tabs)/`: Navegación principal en 4 pestañas:
    1. `index.tsx` (**Hoy**): Panel operativo de tomas pendientes, próximas y registro rápido.
    2. `patients.tsx` (**Miembros**): Gestión de integrantes, alergias, peso, diagnósticos y exportación PDF.
    3. `history.tsx` (**Historial**): Búsqueda y consulta cronológica de dosis y síntomas.
    4. `settings.tsx` (**Familia**): Invitaciones, roles y gestión de sesión familiar.
  * `modals/`: `apply-dose.tsx`, `add-treatment.tsx`, `add-illness.tsx`, `add-symptom.tsx`, `add-member.tsx`.
* **Estado Global (`src/context/KiddoMedContext.tsx`)**: Suscripciones en tiempo real (`onSnapshot`), hidratación inicial desde caché local (`kiddomed_v2_cache`), y reprogramación automática de recordatorios locales al cambiar `treatments` o `members`.
* **Servicios (`src/services/`)**: `kiddomed.ts`, `cache.ts`, `notifications.ts`, `exportPdf.ts`.
* **Sistema de Diseño (`src/theme/tokens.ts` y `src/components/ui/`)**: Paleta y tipografía inspiradas en Apple HIG (`Card`, `PillButton`, `StatusBanner`).

---

## 5. Alcance Actual (V1)

### Incluido en V1
- [x] Arquitectura Expo SDK 58 + Expo Router + TypeScript con generación nativa continua (CNG, sin `ios/` ni `android/` manuales).
- [x] Configuración de builds y canales OTA en `eas.json` (`development`, `preview` APK, `production`).
- [x] Autenticación anónima Firebase y vinculación familiar por código de invitación (`FAM-...`).
- [x] Reglas de seguridad Firestore (`firebase/firestore.rules`) con control por rol (`caregiver` / `patient`) e inmutabilidad en `dose_logs`.
- [x] Prevención transaccional de doble dosis (`min_safety_hours`) con confirmación explícita de excepción (`was_early_override`).
- [x] Gestión de tratamientos por horas, días o PRN (por razón necesaria), incluyendo suspensión y finalización automática por `end_date`.
- [x] Registro de fiebre y síntomas asociados a miembro/enfermedad.
- [x] Caché de lectura offline en `AsyncStorage` y reprogramación local de notificaciones (`expo-notifications`).
- [x] Exportación de resumen clínico en PDF (`expo-print` + `expo-sharing`).

### Explícitamente Excluido de V1 (Fuera de Alcance Actual)
- Edición o eliminación de registros históricos en `dose_logs` (prohibido intencionalmente por auditoría médica).
- Notificaciones push remotas (FCM/APNs) entre dispositivos cuando la app está cerrada (actualmente son recordatorios locales programados en cada dispositivo sincronizado).
- Autenticación con correo/contraseña, Apple Sign-In o Google Sign-In (actualmente se usa Auth Anónima + códigos de invitación).
- Integración con catálogos externos de medicamentos o cálculo automático de dosis por peso.

---

## 6. Estado de Fases y Verificación

| Fase | Estado | Notas |
|---|---|---|
| 1. Fundación Expo + Diseño UI + Modelo de Datos | `COMPLETED` | Base funcional implementada en `src/` |
| 2. Integración Firebase + Reglas + Caché/Notificaciones/PDF | `COMPLETED` | Implementado en `src/services/` y `firebase/firestore.rules` |
| 3. Documentación Viva y Control de Versiones (Git/GitHub) | `IN PROGRESS` | Inicialización de repo, `docs/master_plan.md`, ADRs y push a `Hurtz27/KiddoMed` |
| 4. Validación en Dispositivo / Builds EAS (`preview` / `production`) | `PENDING` | Pendiente de pruebas end-to-end en dispositivo físico y despliegue de `firestore.rules` |

---

## 7. Decisiones Abiertas / Próximos Pasos

- Verificar el despliegue de `firebase/firestore.rules` en el proyecto Firebase configurado en `.env`.
- Ejecutar validación de lint (`npx expo lint`), typecheck (`npx tsc --noEmit`) y pruebas en dispositivo físico mediante `eas build --profile development` o `preview`.
- Evaluar si en V2 se requerirá recuperación de cuenta familiar vía email/OAuth en caso de pérdida de todos los dispositivos vinculados.

---

## 8. Registro de Cambios (Change Log)

| Fecha | Cambio | Decidido por |
|---|---|---|
| 2026-11-16 | Creación inicial de `docs/master_plan.md` y ADRs `0001`–`0004` documentando todas las decisiones arquitectónicas y de producto tomadas hasta la fecha. | Usuario + Asistente |
