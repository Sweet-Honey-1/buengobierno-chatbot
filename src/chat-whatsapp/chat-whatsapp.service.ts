import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class ChatWhatsappService {
  private openai: OpenAI;
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({ apiKey: this.configService.getOrThrow<string>('OPENAI_API_KEY') });
    this.supabase = createClient(
      this.configService.getOrThrow<string>('SUPABASE_URL'),
      this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  async processMessage(from: string, userMessage: string, phoneNumberId: string) {
    try {
      // 1. Recuperar historial de Supabase
      let chatHistory: any[] = [];
      const { data: sessionData, error: sessionError } = await this.supabase
        .from('whatsapp_sessions')
        .select('history')
        .eq('phone_number', from)
        .single();

      if (sessionData && sessionData.history) {
        chatHistory = sessionData.history;
      }

      // Agregamos el nuevo mensaje del usuario al historial
      chatHistory.push({ role: 'user', content: userMessage });
      // Mantenemos solo los últimos 10 mensajes para no gastar demasiados tokens
      if (chatHistory.length > 10) chatHistory = chatHistory.slice(chatHistory.length - 10);

      // 2. Búsqueda Vectorial (RAG)
      const embeddingResponse = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: userMessage,
      });
      const queryEmbedding = embeddingResponse.data[0].embedding;

      const { data: documents } = await this.supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_count: 5,
        filter: {},
      });

      const contextText = documents && documents.length > 0 
        ? documents.map((doc: any) => doc.content).join('\n\n') 
        : '';

      // 3. System Prompt (Pega aquí el prompt mejorado que armamos antes)
      const systemPrompt = `Eres Cocosol... [Pega aquí tu prompt gigante con el contexto] \n\n<CONTEXTO_OFICIAL>\n${contextText}\n</CONTEXTO_OFICIAL>`;

      const messagesForOpenAI = [
        { role: 'system', content: systemPrompt },
        ...chatHistory,
      ];

      // 4. Llamada a OpenAI (SIN STREAMING)
      const aiResponse = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messagesForOpenAI,
        stream: false, // ¡Crucial para WhatsApp!
        temperature: 0.3,
      });

      // Si content es null, le asignamos un mensaje de error por defecto para que no se caiga el sistema
      const botReply = aiResponse.choices[0].message.content || 'Lo siento, en este momento no puedo generar una respuesta. Por favor, intenta de nuevo.';

      // 5. Guardar la nueva respuesta en el historial de Supabase
      chatHistory.push({ role: 'assistant', content: botReply });
      await this.supabase
        .from('whatsapp_sessions')
        .upsert({ phone_number: from, history: chatHistory }, { onConflict: 'phone_number' });

      // 6. Enviar mensaje de vuelta a Meta (WhatsApp)
      await this.sendMessageToWhatsApp(from, botReply, phoneNumberId);

    } catch (error) {
      console.error('Error procesando mensaje de WhatsApp:', error);
    }
  }

  // Método auxiliar para enviar la petición HTTP a la Graph API de Meta
  private async sendMessageToWhatsApp(to: string, text: string, phoneNumberId: string) {
    const token = this.configService.getOrThrow<string>('WHATSAPP_ACCESS_TOKEN');
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: text },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error de Meta API:', errorData);
      }
    } catch (error) {
      console.error('Fallo al enviar mensaje a WhatsApp:', error);
    }
  }
}