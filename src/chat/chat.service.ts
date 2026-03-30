import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable } from 'rxjs';

@Injectable()
export class ChatService {
  private openai: OpenAI;
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    // Inicializamos OpenAI usando getOrThrow para garantizar que el string exista
    this.openai = new OpenAI({
      apiKey: this.configService.getOrThrow<string>('OPENAI_API_KEY'),
    });

    // Inicializamos Supabase con getOrThrow
    this.supabase = createClient(
      this.configService.getOrThrow<string>('SUPABASE_URL'),
      this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  // Método principal que será llamado por el controlador
  async streamResponse(userQuery: string): Promise<Observable<MessageEvent>> {
    
    // 1. Convertir la pregunta del usuario a vector (Embedding)
    const embeddingResponse = await this.openai.embeddings.create({
      model: 'text-embedding-3-small', // Modelo optimizado y económico
      input: userQuery,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 2. Búsqueda Vectorial en Supabase
    // Asegúrate de que 'match_documents' sea el nombre de tu función RPC en Supabase
    const { data: documents, error } = await this.supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: 5,       
      filter: {} 
    });

    if (error) {
      console.error('Error en Supabase:', error);
      throw new InternalServerErrorException('Error al consultar la base de datos de propuestas.');
    }

    // 3. Construir el contexto con los resultados de Supabase
    // Asumimos que la columna de texto en tu tabla se llama 'content'
    const contextText = documents.map((doc: any) => doc.content).join('\n\n');

    const systemPrompt = `Eres Cocosol, el asistente virtual oficial y vocero digital del Partido del Buen Gobierno (PBG). Tu misión es informar a la ciudadanía, resolver dudas y motivar el voto por nuestro candidato a la presidencia del Perú, Jorge Nieto Montesinos.

    REGLAS ESTRICTAS QUE DEBES CUMPLIR:
    1. BASE DE INFORMACIÓN: Responde ÚNICAMENTE utilizando la información que aparece abajo en la sección "CONTEXTO OFICIAL". Si la respuesta no está en el contexto, no la inventes; indica amablemente que no tienes esa información exacta pero invita a revisar las redes oficiales del partido.
    2. ENFOQUE EN EL LÍDER: Al mencionar a Jorge Nieto Montesinos, resalta su experiencia, trayectoria política intachable, honestidad y visión de Estado.
    3. TONO Y PERSONALIDAD: Sé empático, cercano, respetuoso y transmite esperanza. Usa un español peruano natural y accesible (sin jergas vulgares, pero cercano).
    4. MANEJO DE HOSTILIDAD: Si el usuario ataca, critica o insulta, mantén la elegancia. No hables mal de otros candidatos ni entres en discusiones. Redirige la charla a nuestras propuestas constructivas.
    5. LÍMITES TEMÁTICOS: Si preguntan sobre temas ajenos a la política, el Perú o el PBG, aclara que tu función exclusiva es informar sobre la campaña.
    6. ESTRUCTURA OBLIGATORIA: Cuando expliques una propuesta, DEBES organizar tu respuesta usando exactamente estos dos subtítulos en negrita:
       - **Lo que dice el plan de gobierno:** (Explica la propuesta de forma sencilla).
       - **Qué resultaría de estos cambios y mejoras:** (Detalla el beneficio directo para la población).
    7. CIERRE: Despídete siempre invitando a confiar en el PBG y a votar por Jorge Nieto Montesinos.

    CONTEXTO OFICIAL (Plan de Gobierno y Biografía):
    ${contextText}`;

    // 4. Llamar a OpenAI con stream activado
    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini', // Rápido y barato. Puedes usar gpt-4o si necesitas razonamiento complejo.
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery }
      ],
      stream: true, // ¡Aquí está la magia para evitar los 31 segundos!
    });

    // 5. Convertir el AsyncIterable de OpenAI a un Observable de RxJS para el frontend
    return new Observable((subscriber) => {
      (async () => {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              // Emitimos cada palabra/fragmento formateado para Server-Sent Events (SSE)
              subscriber.next({ data: content } as MessageEvent);
            }
          }
          subscriber.complete(); // Cerramos la conexión cuando OpenAI termina
        } catch (err) {
          subscriber.error(err);
        }
      })();
    });
  }
}