import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatModule } from './chat/chat.module';
import { ChatWhatsappModule } from './chat-whatsapp/chat-whatsapp.module';

@Module({
  imports: [
    // forRoot y isGlobal permiten que el .env se lea en toda la aplicación
    ConfigModule.forRoot({
      isGlobal: true, 
    }),
    ChatModule,
    ChatWhatsappModule,
  ],
})
export class AppModule {}