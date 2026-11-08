import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  HttpExceptionFilter,
  keepParserErrorCause,
} from 'src/common/filters/http-exception.filter';
import { createValidationPipe } from 'src/common/pipes/validation.pipe';
import { UPLOADS_PREFIX, uploadsDir } from 'src/shared/files/uploads-config';

// Origens de desenvolvimento: painel web (Vite) e Expo web.
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8081',
  'http://localhost:19006',
];

/**
 * Origens liberadas no CORS: `CORS_ORIGINS` separado por vírgulas (espaços
 * em volta são ignorados) ou, sem ele, as origens de desenvolvimento.
 */
export function parseCorsOrigins(value: string | undefined): string[] {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : DEV_ORIGINS;
}

/** Configuração compartilhada entre main.ts e os testes e2e. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  keepParserErrorCause(app);
  app.enableCors({ origin: parseCorsOrigins(process.env.CORS_ORIGINS) });
  // Arquivos enviados (imagens de questões), fora do prefixo `api/v1`.
  (app as NestExpressApplication).useStaticAssets(uploadsDir(), {
    prefix: UPLOADS_PREFIX,
    index: false,
    redirect: false,
    dotfiles: 'deny',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Nivela API')
      .setDescription('API do Nivela, plataforma de apoio ao nivelamento.')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, document);

  return app;
}
