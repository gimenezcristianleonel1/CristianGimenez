import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Fila cruda tal como la "lee" la IA desde la imagen (sin normalizar). */
export interface VisionRow {
  tagId?: string | null;
  species?: string | null;
  breed?: string | null;
  sex?: string | null;
  birthDate?: string | null;
  initialWeightKg?: number | string | null;
}

const PROMPT = `
Extraé de la imagen un listado de animales de ganado. Puede ser una foto de una
planilla, un cuaderno de campo, una lista impresa o manuscrita.
Respondé SOLO un objeto JSON { "rows": Row[] }, sin markdown ni \`\`\`.
Cada Row:
{
  "tagId": string|null,          // caravana / arete / RP (número o código)
  "species": string|null,        // ej "bovino", "vacuno", "ovino"
  "breed": string|null,          // raza
  "sex": string|null,            // "macho"/"hembra"/"M"/"H"
  "birthDate": string|null,      // fecha si aparece (en su formato original)
  "initialWeightKg": number|null // peso en kg si aparece
}
Reglas:
- Una fila por animal. Si un dato no está, poné null (NO inventes).
- Devolvé TODAS las filas visibles, aunque falten columnas.
- En "tagId" va solo el identificador de la caravana.
`;

/**
 * Lectura de imágenes (JPG/PNG) con Gemini (Google AI Studio, gratis).
 * Devuelve filas crudas; la normalización a nuestro esquema la hace ImportService.
 */
@Injectable()
export class GeminiVisionService {
  private readonly logger = new Logger(GeminiVisionService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return !!this.config.get<string>('gemini.apiKey');
  }

  async extractRows(base64: string, mimeType: string): Promise<VisionRow[]> {
    const apiKey = this.config.get<string>('gemini.apiKey');
    if (!apiKey) return [];
    const model = this.config.get<string>('gemini.model') ?? 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: PROMPT }] },
          contents: [
            {
              role: 'user',
              parts: [
                { text: 'Extraé los animales de esta imagen.' },
                { inline_data: { mime_type: mimeType, data: base64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Gemini vision HTTP ${res.status}`);
        return [];
      }
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return [];
      const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean) as { rows?: VisionRow[] } | VisionRow[];
      const rows = Array.isArray(parsed) ? parsed : parsed?.rows;
      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      this.logger.warn(`Gemini vision falló: ${(err as Error).message}`);
      return [];
    }
  }
}
