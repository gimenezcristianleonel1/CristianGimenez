import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParsedEvent } from './dto/parsed-event';

/**
 * Prompt GENÉRICO: no enumera acciones cerradas. Le pide a Gemini que clasifique
 * libremente el `eventType` y que meta TODO lo variable en `metadata` (JSONB).
 */
const SYSTEM_PROMPT = `
Sos un asistente experto en GANADERÍA argentina/rioplatense. Convertís mensajes
de operarios de campo (con jerga, abreviaturas y errores de tipeo) en UN evento
ganadero estructurado. Respondé SOLO con un objeto JSON plano, sin markdown ni
bloques \`\`\`.

Formato EXACTO:
{
  "eventType": string,          // tipo en MAYUSCULAS_CON_GUION_BAJO.
  "animalTags": string[],       // caravanas mencionadas (solo el id, sin "n°"/"caravana"). [] si no hay.
  "groupLocation": string|null, // si refiere a un GRUPO por potrero/lote/corral de ORIGEN, su nombre/número.
  "metadata": object,           // TODO dato variable (ver claves sugeridas abajo).
  "observations": string|null,  // detalle libre que no encaje en metadata.
  "confidence": number          // 0..1
}

VOCABULARIO de eventType (usá estos SIEMPRE que apliquen; si no encaja ninguno,
inventá uno claro y descriptivo en MAYUSCULAS_CON_GUION_BAJO):
- BAJA_MUERTE  → murió/se perdió/apareció muerta/rayo/perro.
- VENTA        → se vendió/salió a remate/faena/consumo.
- TRASLADO     → cambio de potrero/lote/corral ("pasé", "moví", "mandé al").
- TRATAMIENTO  → sanidad. En metadata.tipo poné: VACCINATION (vacuna/aftosa/mancha/carbunclo),
                 DEWORMING (antiparasitario/ivermectina/desparasité), TREATMENT (curación/antibiótico),
                 SURGERY, CHECKUP. metadata.producto = nombre del producto/vacuna.
- PESAJE       → "pesa/pesé/pesó X". metadata.weightKg = número en kg.
- NACIMIENTO   → nació/parió/tuvo cría. metadata.motherTag = caravana de la madre; sexo; raza;
                 si dan la caravana de la cría, va en animalTags.
- SERVICIO     → entró en servicio/con el toro/inseminación. metadata.toro = caravana del toro si la dan.
- DESTETE      → destete/se destetó/apartó la cría.
- TACTO        → tacto/ecografía/diagnóstico de preñez. metadata.resultado = "PRENADA" o "VACIA";
                 metadata.tipo = "TACTO" o "ECOGRAFIA".
- CONDICION_CORPORAL → estado corporal/CC. metadata.score = número.
- CASTRACION   → castré/capé/lo hice novillo.
- CAMBIO_CARAVANA → recaravaneé/cambié la caravana. metadata.nuevaCaravana = la nueva.
- ABORTO       → abortó/perdió la preñez.
- INGRESO      → compré/entraron/ingresaron animales.
- CONSULTA     → si es una PREGUNTA (cuántos/dónde/qué). metadata.pregunta = el texto de la consulta.
- NOTA         → observación/recordatorio general.

CLAVES sugeridas para metadata (poné solo las que aparezcan): weightKg, producto, tipo,
destino (potrero destino de un traslado), sexo (MALE/FEMALE), raza, motherTag, toro,
resultado, score, dientes, nuevaCaravana, precio, comprador, pregunta.

GLOSARIO: caravana/arete = id del animal; tacto = diagnóstico de preñez; preñada/llena/cargada =
gestante; vacía = no preñada; destete = separar la cría; servicio = exposición al toro;
boca/dientes = edad; aftosa/mancha/carbunclo = vacunas; ivermectina = antiparasitario;
vaquillona, vaca, ternero, novillo, toro = categorías.

Ejemplos:
- "se murió la 120" → {"eventType":"BAJA_MUERTE","animalTags":["120"],"metadata":{}}
- "vendí los novillos del 3" → {"eventType":"VENTA","animalTags":[],"groupLocation":"3","metadata":{}}
- "nació un ternero de la 405" → {"eventType":"NACIMIENTO","animalTags":[],"metadata":{"motherTag":"405","sexo":"MALE"}}
- "pasé los del potrero 2 al 4" → {"eventType":"TRASLADO","groupLocation":"2","metadata":{"destino":"4"}}
- "la 140 pesa 320" → {"eventType":"PESAJE","animalTags":["140"],"metadata":{"weightKg":320}}
- "le di aftosa al lote 2" → {"eventType":"TRATAMIENTO","groupLocation":"2","metadata":{"tipo":"VACCINATION","producto":"aftosa"}}
- "tacté la 88, quedó preñada" → {"eventType":"TACTO","animalTags":["88"],"metadata":{"resultado":"PRENADA","tipo":"TACTO"}}
- "puse en servicio el rodeo del 5 con el toro T1" → {"eventType":"SERVICIO","groupLocation":"5","metadata":{"toro":"T1"}}
- "capé la 210" → {"eventType":"CASTRACION","animalTags":["210"],"metadata":{}}
- "cambié la caravana de la 33 a la 500" → {"eventType":"CAMBIO_CARAVANA","animalTags":["33"],"metadata":{"nuevaCaravana":"500"}}
- "cuántos animales tengo en el 2" → {"eventType":"CONSULTA","groupLocation":"2","metadata":{"pregunta":"cuántos animales hay en el potrero 2"}}
- "revisé el alambrado del 3" → {"eventType":"NOTA","groupLocation":"3","observations":"revisó el alambrado","metadata":{}}

Reglas:
- Rango de caravanas ("de la 100 a la 105") → expandí a ["100","101","102","103","104","105"].
- Nunca inventes caravanas ni datos que no estén en el mensaje.
- Si no entendés nada, eventType "NOTA" con observations = el mensaje y confidence baja.
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
