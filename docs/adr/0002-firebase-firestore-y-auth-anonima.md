# 0002. Firebase Auth Anónimo, Cloud Firestore Multi-Tenant y Auditoría Inmutable

* **Date:** 2026-11-16
* **Status:** Accepted
* **Deciders:** Usuario, Asistente IA

## Context
Múltiples cuidadores de una misma familia necesitan sincronizar tratamientos y registros en tiempo real desde distintos dispositivos, con fricción mínima de registro (sin formularios largos de email/contraseña), pero garantizando aislamiento entre familias y trazabilidad clínica.

## Decision
1. **Autenticación anónima persistente (`signInAnonymously` + `AsyncStorage`):** Cada dispositivo obtiene un `uid` en `src/lib/firebase.ts` y se vincula a una familia mediante creación directa o un código de invitación (`FAM-<NOMBRE>-<4_DIGITOS>`).
2. **Modelo multi-tenant en Cloud Firestore:** Todos los datos familiares residen bajo `/families/{familyId}/...` con un mapa de roles `/families/{familyId}/uid_roles/{uid}` (`caregiver` o `patient`).
3. **Reglas de seguridad (`firebase/firestore.rules`):**
   - `/invites/{inviteCode}` permite `get` puntual pero bloquea `list` (`allow list: if false`).
   - Solo usuarios con rol `caregiver` pueden escribir en `illnesses`, `treatments`, `symptom_logs` y crear en `dose_logs`.
   - `dose_logs` es **append-only** (`allow update, delete: if false`) para preservar la auditoría clínica.

## Consequences
- **Positive:** Sincronización en tiempo real vía `onSnapshot`, onboarding rápido y protección estricta contra borrado accidental de historial de dosis.
- **Trade-offs & Risks:** Si todos los dispositivos de una familia se pierden o borran datos locales sin haber vinculado otro dispositivo, no existe recuperación por correo/contraseña en V1.
