import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Fila cruda tal como la "lee" la IA desde la imagen (sin normalizar). */
export interface VisionRow {
  tagId?: string | null;
  species?: string | null;
  breed?: string | null;
  sex?: string | null;
  birthDate?: string | null;
  entryDate?: string | null;
  initialWeightKg?: number | string | null;
  category?: string | null;
  observations?: string | null;
}

const PROMPT = `
Sos un asistente experto en GANADERÍA argentina/rioplatense. Extraé de la imagen
un listado de animales. Puede ser una foto de una planilla Excel impresa, un
cuaderno de campo, una lista a mano o una hoja de rodeo. La foto puede estar
POCO NÍTIDA, torcida, con reflejos, sombras o letra manuscrita: hacé tu mejor
esfuerzo por leer igual, sin inventar datos que no puedas distinguir.

Respondé SOLO un objeto JSON { "rows": Row[] }, sin markdown ni \`\`\`.
Cada Row:
{
  "tagId": string|null,          // CARAVANA / arete / RP / chapeta: el número o código que identifica al animal
  "species": string|null,        // ej "bovino", "vacuno", "ovino", "porcino"
  "breed": string|null,          // raza (Angus, Hereford, Braford, Brangus, cruza, etc.)
  "sex": string|null,            // "macho"/"hembra"/"M"/"H"
  "birthDate": string|null,      // fecha de NACIMIENTO si aparece (formato original tal cual)
  "entryDate": string|null,      // fecha de INGRESO/entrada/compra/destete si aparece
  "initialWeightKg": number|null,// peso en kg si aparece (ej. "P. INGRESO", "peso")
  "category": string|null,       // CATEGORÍA ganadera (ver glosario)
  "observations": string|null    // TODO otro dato de la fila que no encaje arriba (estado corporal, dientes, tacto, dueño, potrero, etc.)
}

GLOSARIO (categorías de bovinos, Argentina):
- Ternero/Ternera: cría al pie de la madre, hasta el destete (~6-9 meses).
- Vaquillona: hembra destetada que aún no parió (hasta 1ª parición / 2-3 años).
- Vaca: hembra que ya parió al menos una vez. "Vaca con cría/al pie" = con ternero.
- Novillito: macho castrado joven (hasta ~2 años / 4 dientes).
- Novillo: macho castrado adulto.
- Toro/Torito: macho entero (reproductor).
- MEJ: macho entero joven.
Términos: "caravana" = identificación del animal; "nacimiento" = fecha en que nació;
"destete" = separación de la madre; "tacto/preñez" = diagnóstico reproductivo;
"boca/dientes" = cronometría dentaria (edad); "estado corporal" = condición física.

Reglas:
- Una fila por animal. Si un dato no está o no lo podés leer con seguridad, poné null (NO inventes).
- Devolvé TODAS las filas visibles, aunque falten columnas o la imagen esté borrosa.
- En "tagId" va SOLO el identificador de la caravana (sin "n°" ni texto extra).
- OJO: una columna "F. INGRESO"/"Fecha ingreso" es entryDate, NO birthDate.
- Cualquier columna/dato que no tenga un campo propio (dueño, potrero, lote,
  estado corporal, dientes, resultado de tacto, notas) va COMPLETO en "observations"
  con su etiqueta, para no perder información.
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
