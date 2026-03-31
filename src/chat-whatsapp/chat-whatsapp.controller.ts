import { Controller, Get, Post, Body, Query, Res, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ChatWhatsappService } from './chat-whatsapp.service';

@Controller('webhook/whatsapp')
export class ChatWhatsappController {
  constructor(
    private readonly chatWhatsappService: ChatWhatsappService,
    private configService: ConfigService,
  ) {}

  // 1. ENDPOINT PARA VERIFICAR EL WEBHOOK DE META
  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    // Este token lo configurarás tú mismo en el panel de Meta for Developers
    const verifyToken = this.configService.get<string>('WHATSAPP_VERIFY_TOKEN') || 'mi_token_secreto_pbg';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Webhook de WhatsApp verificado');
      return res.status(HttpStatus.OK).send(challenge);
    } else {
      return res.sendStatus(HttpStatus.FORBIDDEN);
    }
  }

  // 2. ENDPOINT PARA RECIBIR MENSAJES DE LOS USUARIOS
  @Post()
  async receiveMessage(@Body() body: any, @Res() res: Response) {
    // Regla de oro de Meta: Responder 200 OK inmediatamente
    res.sendStatus(HttpStatus.OK);

    try {
      // Navegamos por el JSON que envía Meta para extraer el mensaje
      if (body.object === 'whatsapp_business_account') {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const messages = value?.messages;

        if (messages && messages.length > 0) {
          const message = messages[0];
          const phoneNumberId = value.metadata.phone_number_id;
          const from = message.from; // Número de quien escribe
          const msgBody = message.text?.body; // El texto del mensaje

          if (msgBody) {
            console.log(`Mensaje recibido de ${from}: ${msgBody}`);
            // Llamamos al servicio para procesarlo en segundo plano sin detener la respuesta 200
            this.chatWhatsappService.processMessage(from, msgBody, phoneNumberId);
          }
        }
      }
    } catch (error) {
      console.error('Error procesando el webhook de WhatsApp:', error);
    }
  }
}