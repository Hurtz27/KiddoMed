export type RelationshipType =
  | 'hijo'
  | 'hija'
  | 'padre'
  | 'madre'
  | 'abuelo'
  | 'abuela'
  | 'otro';

export type AccessRole = 'caregiver' | 'patient';

export type IllnessStatus = 'active' | 'resolved';

export type TreatmentItemType = 'medication' | 'care';
export type FrequencyType = 'hours' | 'days' | 'prn';
export type TreatmentStatus = 'active' | 'completed' | 'suspended';

export interface FamilySession {
  family_id: string;
  family_name: string;
  member_id: string;
  display_name: string;
  role: AccessRole;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  display_name: string;
  relationship: RelationshipType;
  birth_date: string | null;
  weight_kg: number | null;
  allergies: string[];
  accent_color: string;
  has_app_access: boolean;
  access_role: AccessRole;
  invite_code: string | null;
  linked_uid: string | null;
  created_at: string;
}

export interface Illness {
  id: string;
  family_id: string;
  member_id: string;
  diagnosis: string;
  doctor_name: string;
  diagnosed_at: string;
  status: IllnessStatus;
  notes: string | null;
  created_by_name: string;
  created_at: string;
}

export interface TreatmentItem {
  id: string;
  family_id: string;
  member_id: string;
  illness_id: string;
  item_type: TreatmentItemType;
  brand_name: string; // Nombre de patente o nombre del cuidado
  active_ingredients: string | null; // Elementos activos (si es medicamento)
  dose_text: string; // Ej: "5 ml", "1 tableta", "10 min nebulización"
  start_date: string; // ISO string
  duration_days: number | null; // null si es indefinido/PRN sin días fijos
  end_date: string | null; // Calculado automáticamente (start_date + duration_days)
  frequency_type: FrequencyType;
  frequency_value: number; // Ej: 8 (horas) o 1 (día)
  frequency_label: string; // Ej: "Cada 8 horas" o "Cada que haya fiebre > 38 °C"
  min_safety_hours: number;
  notes: string | null;
  status: TreatmentStatus;
  suspension_reason: string | null;
  next_due_at: string | null;
  doses_administered_count: number;
  created_at: string;
}

export interface DoseLog {
  id: string;
  family_id: string;
  member_id: string;
  illness_id: string;
  treatment_item_id: string;
  administered_at: string; // Hora real (permite hora anterior)
  administered_by_member_name: string;
  dose_text: string;
  was_early_override: boolean;
  notes: string | null;
  created_at: string;
}

export interface SymptomLog {
  id: string;
  family_id: string;
  member_id: string;
  illness_id: string | null;
  recorded_at: string;
  temperature_celsius: number | null;
  symptoms: string[];
  notes: string | null;
  recorded_by_name: string;
  created_at: string;
}

export type RegisterDoseResult =
  | {
      status: 'OK';
      log_id: string;
      administered_at: string;
      next_due_at: string | null;
    }
  | {
      status: 'TOO_EARLY';
      last_member: string;
      minutes_ago: number;
      min_safety_hours: number;
    };
