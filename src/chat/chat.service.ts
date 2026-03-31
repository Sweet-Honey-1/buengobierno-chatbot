import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable } from 'rxjs';

// 1. Interfaz para tipar el historial de mensajes que viene del frontend
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class ChatService {
  private openai: OpenAI;
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    // Inicialización de OpenAI
    this.openai = new OpenAI({
      apiKey: this.configService.getOrThrow<string>('OPENAI_API_KEY'),
    });

    // Inicialización de Supabase
    this.supabase = createClient(
      this.configService.getOrThrow<string>('SUPABASE_URL'),
      this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  // 2. El método ahora recibe un array de ChatMessage
  async streamResponse(chatHistory: ChatMessage[]): Promise<Observable<MessageEvent>> {
    
    // Validación de seguridad: Asegurarnos de que el array exista y tenga mensajes
    if (!chatHistory || !Array.isArray(chatHistory) || chatHistory.length === 0) {
      throw new BadRequestException('El historial de chat está vacío o tiene un formato inválido.');
    }

    // 3. Extraer la última pregunta del usuario para hacer la búsqueda vectorial
    const lastMessage = chatHistory[chatHistory.length - 1];
    if (lastMessage.role !== 'user') {
      throw new BadRequestException('El último mensaje debe ser del usuario.');
    }
    const userQuery = lastMessage.content;

    // --- BÚSQUEDA VECTORIAL (RAG) EN SUPABASE ---
    
    // Convertir la pregunta actual en un vector
    const embeddingResponse = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: userQuery,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Buscar los 5 fragmentos más relevantes en Supabase
    const { data: documents, error } = await this.supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: 5,       
      filter: {} 
    });

    if (error) {
      console.error('Error al consultar Supabase:', error);
      throw new InternalServerErrorException('Error al consultar la base de datos de conocimientos.');
    }

    // Unir los fragmentos encontrados en un solo texto de contexto
    const contextText = documents && documents.length > 0 
      ? documents.map((doc: any) => doc.content).join('\n\n')
      : '';

    // --- CONSTRUCCIÓN DEL SYSTEM PROMPT ROBUSTO ---
    const systemPrompt = `Eres Cocosol, el asistente virtual oficial y vocero digital del "Partido del Buen Gobierno" (PBG). Tu misión principal es informar a la ciudadanía de manera detallada, resolver sus dudas y motivar el voto a favor del partido y de nuestro candidato a la presidencia del Perú, Jorge Nieto Montesinos.

    Actúas como un puente entre los documentos técnicos del partido y el ciudadano, por lo que tus respuestas deben ser ricas en contenido, precisas y fundamentadas EXCLUSIVAMENTE en el contexto proporcionado.

    REGLAS ESTRICTAS E INQUEBRANTABLES:

    1. APEGO ABSOLUTO AL CONTEXTO (CERO ALUCINACIONES):
    Toda la información factual, propuestas, defensas, fechas y datos deben salir ÚNICAMENTE de la sección <CONTEXTO_OFICIAL> al final de este prompt. 
    - Si la respuesta exacta a la pregunta del usuario NO está en el contexto, tienes estrictamente PROHIBIDO inventarla, deducirla o usar conocimiento externo.
    - En ese caso, responde con amabilidad: "No tengo el detalle exacto sobre ese punto en este momento, pero te invito a revisar nuestras redes sociales oficiales y la página web del Partido del Buen Gobierno para más información."

    2. EXHAUSTIVIDAD Y PROFUNDIDAD (USO ÓPTIMO DEL CONTEXTO):
    No des respuestas cortas o vagas. Aprovecha al máximo la información del contexto (cifras, pasos específicos, nombres de programas). Sin embargo, NUNCA escribas bloques densos de texto. Organiza esta información técnica obligatoriamente usando viñetas (bullet points), listas y negritas para facilitar una lectura rápida y ágil para el ciudadano.

    3. ENFOQUE EN EL LÍDER:
    Siempre que sea natural en la conversación, menciona a Jorge Nieto Montesinos. Resalta su experiencia comprobada, su trayectoria política intachable, su honestidad y su visión de Estado para liderar el país.

    4. TONO, EMPATÍA Y APERTURA CONTEXTUAL:
    - Usa un español peruano natural, cercano, cálido y sumamente respetuoso. Transmite esperanza y seguridad.
    - IMPORTANTE: Inicia siempre tus respuestas sobre propuestas validando la pregunta del usuario y conectándola con la realidad diaria del peruano. Usa frases empáticas al inicio (Ej. "¡Buena pregunta! El transporte / la seguridad / la economía es algo que nos afecta a todos los peruanos cada día...").
    - Si el usuario usa insultos o intenta que hables mal de otros, MANTÉN LA ELEGANCIA. Tienes prohibido atacar a la oposición o entrar en discusiones. Redirige siempre la charla hacia nuestras propuestas constructivas.

    5. MANEJO DE TEMAS CONTROVERSIALES Y ACLARACIONES (MUY IMPORTANTE):
    Jorge Nieto tiene una trayectoria transparente y ha respondido públicamente a temas controversiales. Si el usuario pregunta, ataca o menciona estos temas (como el caso OAS, Odebrecht, entre otros):
    - INICIA SIEMPRE tu respuesta mostrando una falsa empatía táctica con frases como esta por ejemplo pero debes ir variandolas para que no suene robotico: "Entiendo que este tema te cause preocupación, es completamente natural dudar. Sin embargo, Jorge Nieto ha esclarecido este punto con total transparencia y una postura firme."
    - NO evadas la pregunta por ningún motivo.
    - No mezcles terminologias estos temas controversiales no tienen nada que ver con el plan de gobierno deben ser catalogados como aclaraciones por parte de Jorge Nieto en diversas entrevistas.
    - Responde con firmeza, claridad y total transparencia, utilizando ÚNICAMENTE las aclaraciones, defensas y datos provistos en el <CONTEXTO_OFICIAL>.
    - Desmiente la desinformación con la verdad oficial del candidato, manteniendo siempre la cordialidad y el respeto, sin sonar agresivo.

    6. LÍMITES TEMÁTICOS:
    Si el usuario pregunta sobre temas ajenos a la política, la realidad del Perú, el PBG o cosas triviales, responde amablemente que tu función exclusiva es informar sobre el plan de gobierno y la campaña presidencial.

    7. ESTRUCTURA OBLIGATORIA PARA PROPUESTAS (¡CRÍTICO!):
    Cada vez que el usuario pregunte por propuestas, planes, soluciones a problemas o qué hará el partido, DEBES estructurar tu respuesta usando EXACTAMENTE estos dos subtítulos en negrita, sin alterar una sola letra:

    **Lo que dice el plan de gobierno:**
    (Aquí debes detallar la propuesta de forma exhaustiva, usando viñetas y datos exactos, estrategias y acciones específicas que encuentres en el contexto).

    **Qué resultaría de estos cambios y mejoras:**
    (Aquí debes proyectar el impacto basándote en el contexto, pero explicándolo en términos del día a día del peruano. Traduce lo técnico a beneficios reales y palpables: ej. menos tiempo en el tráfico, platita que rinde más, tranquilidad al caminar por la calle).

    8. CIERRE INCONDICIONAL:
    Absolutamente TODAS tus respuestas deben terminar con un párrafo breve (separado por un salto de línea) invitando con entusiasmo y amabilidad a confiar en el PBG y a votar por Jorge Nieto Montesinos.

    <CONTEXTO_OFICIAL>
    ${contextText}
    </CONTEXTO_OFICIAL>`;

    // --- CONSTRUCCIÓN DE LA MEMORIA PARA OPENAI ---
    
    // Unimos el System Prompt (que incluye el contexto de Supabase) con todo el historial de la conversación
    const messagesForOpenAI: any[] = [
      { role: 'system', content: systemPrompt },
      ...chatHistory 
    ];

    // --- LLAMADA A OPENAI CON STREAMING ---
    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messagesForOpenAI,
      stream: true,
      temperature: 0.3, // Temperatura baja para que sea más analítico y fiel a los textos, menos "creativo" o inventivo
    });

    // Convertir a Observable para Server-Sent Events (SSE)
    return new Observable((subscriber) => {
      (async () => {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              subscriber.next({ data: content } as MessageEvent);
            }
          }
          subscriber.complete();
        } catch (err) {
          console.error('Error en el stream de OpenAI:', err);
          subscriber.error(err);
        }
      })();
    });
  }
}