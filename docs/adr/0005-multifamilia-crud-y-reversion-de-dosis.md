# 0005. Soporte Multi-Familia, CRUD en Cascada, Reversión de Dosis y Agenda Horaria

* **Date:** 2026-11-16
* **Status:** Accepted
* **Deciders:** Usuario, Asistente IA

## Context
Al evolucionar la app para uso real en dispositivos compartidos y escenarios con más de un núcleo familiar (p. ej. casa de padres y casa de abuelos, o familias extendidas), surgieron cuatro necesidades:
1. Poder vincular y alternar entre **múltiples familias** desde un mismo dispositivo sin cerrar sesión ni perder datos en caché.
2. Permitir **editar y corregir errores humanos** (editar/eliminar miembros, enfermedades, tratamientos, síntomas y revertir una dosis marcada por error).
3. Reemplazar la vista plana de "Hoy" por una **agenda horaria de 7 días** agrupada por franjas de 30 minutos y por integrante, además de separar notas/síntomas en su propia pestaña.
4. Habilitar `existsAfter`/`getAfter` y permisos `delete` para cuidadores en `firestore.rules` para soportar operaciones en lote y reversión de dosis.

## Decision
1. **Gestión Multi-Familia (`src/services/cache.ts`, `src/context/KiddoMedContext.tsx`):**
   - Se migra automáticamente la sesión única heredada (`kiddomed_v2_session`) a `kiddomed_v2_families` + `kiddomed_v2_active_family_id`, aislando la caché de lectura por `familyId` (`kiddomed_v2_cache_<familyId>`).
   - Se agregan `addOrSelectFamily`, `switchFamily` y `leaveFamily`, junto con `FamilySwitcherBar` y el modal `modals/add-family.tsx`.
2. **CRUD Completo y Reversión Transaccional (`src/services/kiddomed.ts`, `firestore.rules`):**
   - Se implementan `updateFamilyMember`, `deleteFamilyMember`, `updateIllnessRecord`, `deleteIllnessRecord`, `updateTreatmentItemRecord`, `updateSymptomLogRecord`, `deleteSymptomLogRecord` (con borrado en cascada por lotes de hasta 450 operaciones).
   - Se añade `revertDoseLogTransaction`, que elimina un `DoseLog` y recalcula dentro de `runTransaction` `doses_administered_count`, `next_due_at`, `last_administered_at` y `last_administered_by`.
   - En `firestore.rules` (raíz), se habilita `create, update, delete: if isCaregiver(familyId)` en `dose_logs` (relajando la restricción `append-only` de ADR 0002 exclusivamente para cuidadores) y se usa `existsAfter`/`getAfter` para validar escrituras atómicas iniciales.
3. **Agenda Horaria y Navegación de 5 Pestañas (`src/utils/schedule.ts`, `src/app/(tabs)/`):**
   - Se incorpora la pestaña **Notas** (`notes.tsx`), renombrando la pestaña principal a **Dosis** (`index.tsx`) e integrando `buildTreatmentSchedule`, `WeekStrip`, `HeroDoseCard` y `SlotDoseModal`.
   - Se añaden pantallas de detalle `member-illnesses.tsx` e `illness-detail.tsx` y componentes reutilizables (`FamilyAccessForm`, `IllnessForm`, `ChipGroup`, `FormField`, `GroupedListRow`, `QuickActionTile`, `SegmentedControl`).

## Consequences
- **Positive:** Mayor tolerancia a errores de captura, soporte multi-familia sin fricción, vista diaria más clara por franjas horarias y reglas de Firestore compatibles con creación atómica en batch.
- **Trade-offs & Risks:** Al permitir que un `caregiver` elimine registros en `dose_logs`, la inmutabilidad estricta de auditoría pasa a depender de la disciplina del rol cuidador; además, conviene mantener sincronizada una sola ubicación canónica de `firestore.rules` (actualmente existe `firestore.rules` en raíz y la versión previa en `firebase/firestore.rules`).
