/**
 * Contrato del JSON que devuelve Gemini. Es GENÉRICO a propósito: el tipo de
 * evento es libre (`eventType`) y todos los datos variables viajan en `metadata`
 * (JSONB). Así, agregar acciones nuevas no requiere tocar el parser.
 */
export interface ParsedEvent {
  /** Tipo de evento en MAYÚSCULAS_CON_GUION_BAJO (libre). Ej: BAJA_MUERTE, TRASLADO. */
  eventType: string;
  /** Caravanas mencionadas explícitamente (0..n). */
  animalTags: string[];
  /** Selector de grupo por potrero/lote (ej. "los del 2"), opcional. */
  groupLocation: string | null;
  /** Bolsa de datos variables (sexo, destino, producto, kg, madre, etc.). */
  metadata: Record<string, unknown>;
  /** Detalle libre. */
  observations: string | null;
  /** Confianza 0..1. */
  confidence: number;
}
