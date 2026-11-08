import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { configureApp } from 'src/app.factory';

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule));
  await app.listen(process.env.PORT ?? 8000, '0.0.0.0');
}
void bootstrap();
