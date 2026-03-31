import { Controller, Post, Body, Sse, BadRequestException, MessageEvent } from '@nestjs/common';
import { ChatService, ChatMessage } from './chat.service'; // Asegúrate de exportar ChatMessage desde tu service
import { Observable } from 'rxjs';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Cambiamos @Query por @Body y convertimos el endpoint a @Post
  @Post('stream')
  @Sse() // Mantenemos SSE para la respuesta en tiempo real
  async streamMessage(@Body('history') history: ChatMessage[]): Promise<Observable<MessageEvent>> {
    
    // Validamos que el frontend envíe el arreglo correctamente
    if (!history || !Array.isArray(history) || history.length === 0) {
      throw new BadRequestException('El cuerpo de la petición debe contener un arreglo "history" con los mensajes.');
    }
    
    // Llamamos al servicio pasándole todo el historial
    return await this.chatService.streamResponse(history);
  }
}