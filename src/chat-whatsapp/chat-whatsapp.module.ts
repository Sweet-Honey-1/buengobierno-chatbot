import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatWhatsappController } from './chat-whatsapp.controller';
import { ChatWhatsappService } from './chat-whatsapp.service';

@Module({
  imports: [ConfigModule], // Importamos ConfigModule para poder usar process.env o ConfigService
  controllers: [ChatWhatsappController],
  providers: [ChatWhatsappService],
})
export class ChatWhatsappModule {}