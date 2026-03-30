import { Controller, Sse, Query, BadRequestException, MessageEvent } from '@nestjs/common';
import { ChatService } from './chat.service';
import { Observable } from 'rxjs';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // El decorador @Sse abre una conexión de Server-Sent Events
  @Sse('stream')
  async streamMessage(@Query('message') message: string): Promise<Observable<MessageEvent>> {
    if (!message) {
      throw new BadRequestException('El parámetro "message" es obligatorio.');
    }
    
    // Llamamos a tu servicio pasándole la pregunta del usuario
    return await this.chatService.streamResponse(message);
  }
}