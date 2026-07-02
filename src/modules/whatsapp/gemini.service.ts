import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParsedEvent } from './dto/parsed-event';

/**
 * Prompt GENÉRICO: no enumera acciones cerradas. Le pide a Gemini que clasifique
 * libremente el `eventType` y que meta TODO lo variable en `metadata` (JSONB).
 */
const SYSTEM_PROMPT = `
Convertís mensajes de operarios de campo (español rioplatense) en un evento
ganadero estructurado. Respondé SOLO con un objeto JSON plano, sin markdown ni
bloques \`\`\`.

Formato EXACTO:
{
  "eventType": string,          // tipo en MAYUSCULAS_CON_GUION_BAJO (libre).
  "animalTags": string[],       // caravanas mencionadas (solo el id, sin "n°"). [] si no hay.
  "groupLocation": string|null, // si refiere a un grupo por potrero/lote de ORIGEN, su nombre/número.
  "metadata": object,           // TODO dato variable: sexo, raza, destino, producto, kg, madre, etc.
  "observations": string|null,  // detalle libre.
  "confidence": number          // 0..1
}

Guías (orientativas, no exhaustivas):
- "se murió/perdí la 120" -> eventType "BAJA_MUERTE", animalTags ["120"].
- "se vendió el novillo 88" -> "VENTA", animalTags ["88"].
- "nació un ternero de la madre 405" -> "NACIMIENTO", metadata {"motherTag":"405","sexo":"MALE"};
  si dice la caravana de la cría, ponela en animalTags.
- "pasé los del potrero 2 al 4" -> "TRASLADO", groupLocation "2", metadata {"destino":"4"}.
- "el 140 pesa 320" -> "PESAJE", animalTags ["140"], metadata {"weightKg":320}.
- "le di antiparasitario al lote 2" -> "TRATAMIENTO", groupLocation "2",
  metadata {"producto":"antiparasitario","tipo":"DEWORMING"}.
- Si es una acción NUEVA que no está en los ejemplos, igual inventá un eventType
  claro y descriptivo (no uses "DESCONOCIDO" salvo que no entiendas nada).
- Nunca inventes caravanas ni datos que no estén en el mensaje.
`;

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return !!this.config.get<string>('gemini.apiKey');
  }

  /** Devuelve el evento estructurado o null si no se pudo interpretar. */
  async parse(message: string): Promise<ParsedEvent | null> {
    const apiKey = this.config.get<string>('gemini.apiKey');
    if (!apiKey) return null;
    const model = this.config.get<string>('gemini.model') ?? 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: message }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Gemini HTTP ${res.status}`);
        return null;
      }
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;

      // Defensa por si el modelo devuelve ```json ... ```
      const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean) as Partial<ParsedEvent>;

      // Normalización defensiva del contrato.
      return {
        eventType: String(parsed.eventType ?? 'NOTA').toUpperCase(),
        animalTags: Array.isArray(parsed.animalTags) ? parsed.animalTags.map(String) : [],
        groupLocation: parsed.groupLocation != null ? String(parsed.groupLocation) : null,
        metadata:
          parsed.metadata && typeof parsed.metadata === 'object'
            ? (parsed.metadata as Record<string, unknown>)
            : {},
        observations: parsed.observations != null ? String(parsed.observations) : null,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      };
    } catch (err) {
      this.logger.warn(`Gemini parse falló: ${(err as Error).message}`);
      return null;
    }
  }
}
