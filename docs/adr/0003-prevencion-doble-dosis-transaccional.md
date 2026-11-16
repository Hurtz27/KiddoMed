# 0003. Prevención Transaccional de Doble Dosis en Firestore

* **Date:** 2026-11-16
* **Status:** Accepted
* **Deciders:** Usuario, Asistente IA

## Context
Cuando dos cuidadores (por ejemplo, madre y padre) atienden a un paciente al mismo tiempo, existe el riesgo crítico de administrar dos veces el mismo medicamento dentro de una ventana de seguridad mínima (`min_safety_hours`).

## Decision
Centralizar el registro de dosis en `registerDoseTransaction` (`src/services/kiddomed.ts`) utilizando una transacción atómica de Firestore (`runTransaction`):
1. Lee el documento del tratamiento dentro de la transacción y compara `administeredAtIso` contra `last_administered_at`.
2. Si la diferencia en horas es menor a `min_safety_hours` (y `>= 0`) y no se envió `forceOverride: true`, aborta la escritura y retorna `{ status: 'TOO_EARLY', last_member, minutes_ago, min_safety_hours }`.
3. Si cumple el intervalo o el cuidador confirma explícitamente la excepción (`was_early_override: true`), crea el `DoseLog` y actualiza `doses_administered_count`, `last_administered_at`, `last_administered_by`, `next_due_at` y `status` (`completed` si supera `end_date`).
4. Para tratamientos `prn` (por razón necesaria), `next_due_at` se calcula usando `min_safety_hours` para indicar cuándo vuelve a ser seguro administrar.

## Consequences
- **Positive:** Evita condiciones de carrera entre dispositivos concurrentes y deja rastro explícito (`was_early_override`) cuando se fuerza una toma anticipada.
- **Trade-offs & Risks:** Requiere conectividad con Firestore para ejecutar la transacción en el momento del registro.
