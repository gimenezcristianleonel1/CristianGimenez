import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FIELDS, AppField } from './header-matching';

/**
 * Pre-mapeo de columnas con Gemini (Google AI Studio, gratis). Recibe los
 * encabezados crudos de un Excel/CSV y sugiere qué columna corresponde a cada
 * campo del esquema (Animal), analizando sinónimos. Degrada silenciosamente
 * (devuelve {}) si no hay API key o si la IA falla: el llamador cae al matcher local.
 */
const SYSTEM_PROMPT = `
Mapeás los encabezados de una planilla ganadera a los campos de un sistema.
Campos destino y sinónimos habituales:
- tagId: caravana, arete, rp, id, numero, nro, identificacion, chapeta, crotal, tag.
- species: especie, tipo, tipo animal.
- breed: raza.
- sex: sexo, genero.
- birthDate: fecha de nacimiento, nacimiento, f_nac, fnac, nac, dob.
- initialWeightKg: peso, peso inicial, kg, kilos, pesaje, weight.

Te paso la lista EXACTA de columnas del archivo. Respondé SOLO un JSON plano:
{ "tagId": <columna>|null, "species": <columna>|null, "breed": <columna>|null,
  "sex": <columna>|null, "birthDate": <columna>|null, "initialWeightKg": <columna>|null }
Reglas:
- El valor debe ser el nombre EXACTO de una columna de la lista, o null si ninguna aplica.
- No inventes columnas ni uses nombres que no estén en la lista.
- Una columna no debería asignarse a dos campos.
`;

@Injectable()
export class GeminiMappingService {
  private readonly logger = new Logger(GeminiMappingService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return !!this.config.get<string>('gemini.apiKey');
  }

  /** Sugiere { campo: columna } para los encabezados dados. {} si no aplica. */
  async suggestMapping(headers: string[]): Promise<Partial<Record<AppField, string>>> {
    const apiKey = this.config.get<string>('gemini.apiKey');
    if (!apiKey || headers.length === 0) return {};
    const model = this.config.get<string>('gemini.model') ?? 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            { role: 'user', parts: [{ text: `Columnas: ${JSON.stringify(headers)}` }] },
          ],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Gemini mapping HTTP ${res.status}`);
        return {};
      }
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return {};
      const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean) as Record<string, unknown>;

      // Validación: solo campos válidos y columnas que existan de verdad.
      const headerSet = new Set(headers);
      const out: Partial<Record<AppField, string>> = {};
      for (const field of APP_FIELDS) {
        const value = parsed[field];
        if (typeof value === 'string' && headerSet.has(value)) out[field] = value;
      }
      return out;
    } catch (err) {
      this.logger.warn(`Gemini mapping falló: ${(err as Error).message}`);
      return {};
    }
  }
}
