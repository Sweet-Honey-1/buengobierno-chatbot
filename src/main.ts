import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Habilitamos CORS para que el chat web pueda conectarse
  app.enableCors(); 
// Escucha el puerto que asigne la nube, o usa el 3000 si estás en tu PC
  await app.listen(process.env.PORT || 3000);
}
bootstrap();