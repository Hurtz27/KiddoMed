import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import {
  DoseLog,
  FamilyMember,
  Illness,
  SymptomLog,
  TreatmentItem,
} from '../types/database';
import { calculateAgeLabel, formatDateOnly, formatDateTimeShort, getRelationshipLabel } from '../utils/formatting';

export async function exportMemberPdf(params: {
  member: FamilyMember;
  illnesses: Illness[];
  treatments: TreatmentItem[];
  doseLogs: DoseLog[];
  symptomLogs: SymptomLog[];
}): Promise<void> {
  const { member, illnesses, treatments, doseLogs, symptomLogs } = params;
  const treatmentMap = new Map(treatments.map((t) => [t.id, t]));

  const illnessRows = illnesses
    .slice(0, 10)
    .map(
      (ill) => `
      <tr>
        <td>${formatDateOnly(ill.diagnosed_at)}</td>
        <td><strong>${escapeHtml(ill.diagnosis)}</strong><br/><small>Dr./Dra. ${escapeHtml(ill.doctor_name)}</small></td>
        <td>${ill.status === 'active' ? 'Activa' : 'Resuelta'}</td>
      </tr>`
    )
    .join('');

  const doseRows = doseLogs
    .slice(0, 40)
    .map((d) => {
      const tr = treatmentMap.get(d.treatment_item_id);
      const medTitle = tr
        ? `${tr.brand_name}${tr.active_ingredients ? ` (${tr.active_ingredients})` : ''}`
        : 'Tratamiento';
      return `
      <tr>
        <td>${formatDateTimeShort(d.administered_at)}</td>
        <td>${escapeHtml(medTitle)}</td>
        <td>${escapeHtml(d.dose_text)}</td>
        <td>${escapeHtml(d.administered_by_member_name)}${d.notes ? `<br/><small>${escapeHtml(d.notes)}</small>` : ''}</td>
      </tr>`;
    })
    .join('');

  const symptomRows = symptomLogs
    .slice(0, 30)
    .map(
      (s) => `
      <tr>
        <td>${formatDateTimeShort(s.recorded_at)}</td>
        <td>${s.temperature_celsius !== null ? `<strong>${s.temperature_celsius.toFixed(1)} °C</strong>` : '-'}</td>
        <td>${escapeHtml(s.symptoms.join(', ') || '-')}</td>
        <td>${escapeHtml(s.notes || '-')}</td>
      </tr>`
    )
    .join('');

  const age = calculateAgeLabel(member.birth_date);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; padding: 24px; }
        h1 { color: #0F6B64; margin-bottom: 4px; font-size: 22px; }
        .meta { color: #475569; font-size: 13px; margin-bottom: 18px; }
        .allergies { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 8px 12px; border-radius: 6px; margin-bottom: 18px; font-size: 13px; }
        h2 { font-size: 15px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 22px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
        th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        th { background: #f8fafc; color: #475569; font-weight: 600; }
      </style>
    </head>
    <body>
      <h1>HL KiddoMed — Resumen Clínico</h1>
      <div class="meta">
        <strong>Miembro:</strong> ${escapeHtml(member.display_name)} (${getRelationshipLabel(member.relationship)}${age ? `, ${age}` : ''})
        ${member.weight_kg ? ` · <strong>Peso:</strong> ${member.weight_kg} kg` : ''}
        · <strong>Generado:</strong> ${formatDateTimeShort(new Date().toISOString())}
      </div>
      ${
        member.allergies.length > 0
          ? `<div class="allergies"><strong>Alergias:</strong> ${escapeHtml(member.allergies.join(', '))}</div>`
          : ''
      }

      <h2>Diagnósticos</h2>
      <table>
        <thead><tr><th>Fecha</th><th>Diagnóstico / Médico</th><th>Estado</th></tr></thead>
        <tbody>${illnessRows || '<tr><td colspan="3">Sin diagnósticos registrados.</td></tr>'}</tbody>
      </table>

      <h2>Tomas y Aplicaciones Administradas</h2>
      <table>
        <thead><tr><th>Fecha/Hora</th><th>Tratamiento (Patente / Activo)</th><th>Dosis</th><th>Administró</th></tr></thead>
        <tbody>${doseRows || '<tr><td colspan="4">Sin aplicaciones registradas.</td></tr>'}</tbody>
      </table>

      <h2>Temperatura y Síntomas</h2>
      <table>
        <thead><tr><th>Fecha/Hora</th><th>Temp.</th><th>Síntomas</th><th>Notas</th></tr></thead>
        <tbody>${symptomRows || '<tr><td colspan="4">Sin síntomas registrados.</td></tr>'}</tbody>
      </table>
    </body>
    </html>
  `;

  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Resumen Médico - ${member.display_name}`,
      UTI: 'com.adobe.pdf',
    });
  } else {
    await Print.printAsync({ html });
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
