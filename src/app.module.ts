import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    // forRoot y isGlobal permiten que el .env se lea en toda la aplicación
    ConfigModule.forRoot({
      isGlobal: true, 
    }),
    ChatModule,
  ],
})
export class AppModule {}