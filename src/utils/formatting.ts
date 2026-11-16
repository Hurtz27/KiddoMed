import { RelationshipType } from '../types/database';

export function formatTimeShort(iso: string | null): string {
  if (!iso) return 'Sin hora';
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDateOnly(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTimeShort(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Hoy ${timeStr}`;

  const dateStr = date.toLocaleDateString([], { day: '2-digit', month: 'short' });
  return `${dateStr} ${timeStr}`;
}

export function calculateEndDateIso(startIso: string, durationDays: number | null): string | null {
  if (!durationDays || durationDays <= 0) return null;
  const d = new Date(startIso);
  d.setDate(d.getDate() + durationDays);
  return d.toISOString();
}

export function calculateAgeLabel(birthDateStr: string | null): string {
  if (!birthDateStr) return '';
  const birth = new Date(birthDateStr);
  if (Number.isNaN(birth.getTime())) return '';
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return 'Recién nacido';
  if (months < 24) return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths > 0 ? `${years}a ${remMonths}m` : `${years} años`;
}

export function getRelationshipLabel(rel: RelationshipType): string {
  const map: Record<RelationshipType, string> = {
    hijo: 'Hijo',
    hija: 'Hija',
    padre: 'Padre',
    madre: 'Madre',
    abuelo: 'Abuelo',
    abuela: 'Abuela',
    otro: 'Otro',
  };
  return map[rel] ?? rel;
}

export function formatMinutesDiff(targetIso: string): { label: string; isOverdue: boolean } {
  const diffMins = Math.round((new Date(targetIso).getTime() - Date.now()) / 60000);
  if (diffMins <= 0) {
    const overdue = Math.abs(diffMins);
    return {
      label: overdue < 2 ? '¡Toca ahora!' : `Atrasada ${formatMinsText(overdue)}`,
      isOverdue: true,
    };
  }
  return {
    label: `En ${formatMinsText(diffMins)}`,
    isOverdue: false,
  };
}

function formatMinsText(totalMins: number): string {
  if (totalMins < 60) return `${totalMins} min`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function getTemperatureColor(temp: number | null): string {
  if (temp === null) return '#64748B';
  if (temp >= 38.0) return '#DC2626';
  if (temp >= 37.5) return '#D97706';
  return '#16A34A';
}
