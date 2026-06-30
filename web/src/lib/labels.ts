import type {
  AnimalStatus,
  HealthEventType,
  LocationType,
  MovementReason,
  Sex,
  Species,
} from './types';

export const speciesLabel: Record<Species, string> = {
  BOVINE: 'Bovino',
  PORCINE: 'Porcino',
  OVINE: 'Ovino',
  CAPRINE: 'Caprino',
  EQUINE: 'Equino',
  OTHER: 'Otro',
};

export const sexLabel: Record<Sex, string> = { MALE: 'Macho', FEMALE: 'Hembra' };

export const statusLabel: Record<AnimalStatus, string> = {
  ACTIVE: 'Activo',
  QUARANTINE: 'Cuarentena',
  READY_FOR_SALE: 'Listo para venta',
  SOLD: 'Vendido',
  DECEASED: 'Fallecido',
};

export const locationTypeLabel: Record<LocationType, string> = {
  PASTURE: 'Potrero',
  PEN: 'Corral',
  CORRAL: 'Corral',
  BARN: 'Establo',
  QUARANTINE_AREA: 'Área de cuarentena',
  PADDOCK: 'Lote',
};

export const healthEventLabel: Record<HealthEventType, string> = {
  VACCINATION: 'Vacunación',
  DEWORMING: 'Desparasitación',
  TREATMENT: 'Tratamiento',
  SURGERY: 'Cirugía',
  CHECKUP: 'Control',
  OTHER: 'Otro',
};

export const movementReasonLabel: Record<MovementReason, string> = {
  ROTATION: 'Rotación',
  OVERGRAZING_PREVENTION: 'Evitar sobrepastoreo',
  MEDICAL: 'Médico',
  WEANING: 'Destete',
  SALE_PREPARATION: 'Preparación de venta',
  REGROUPING: 'Reagrupamiento',
  OTHER: 'Otro',
};

export function fmtDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR');
}
