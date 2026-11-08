import { Controller, Get, Type } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import {
  DiscoveryModule,
  DiscoveryService,
  MetadataScanner,
  Reflector,
} from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { ANY_AUTHENTICATED_KEY } from 'src/common/decorators/any-authenticated.decorator';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public.decorator';
import { ROLES_KEY } from 'src/common/decorators/roles.decorator';

/**
 * Lista as rotas que não declaram quem pode acessá-las: nem `@Public()`,
 * nem `@AnyAuthenticated()`, nem `@Roles(...)` (no método ou no controller).
 */
function routesWithoutAuthorization(controllers: Type[]): string[] {
  const reflector = new Reflector();
  const scanner = new MetadataScanner();
  const missing: string[] = [];

  for (const controller of controllers) {
    const prototype = controller.prototype as Record<string, unknown>;
    for (const name of scanner.getAllMethodNames(prototype)) {
      const handler = prototype[name];
      if (
        typeof handler !== 'function' ||
        Reflect.getMetadata(METHOD_METADATA, handler) === undefined
      ) {
        continue;
      }
      const targets = [handler, controller];
      const roles = reflector.getAllAndOverride<unknown[] | undefined>(
        ROLES_KEY,
        targets,
      );
      const declared =
        reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets) ||
        reflector.getAllAndOverride<boolean>(ANY_AUTHENTICATED_KEY, targets) ||
        (roles?.length ?? 0) > 0;
      if (!declared) {
        missing.push(`${controller.name}.${name}`);
      }
    }
  }
  return missing;
}

@Controller('esquecido')
class ControllerEsquecido {
  @Get()
  listar() {
    return [];
  }
}

describe('Autorização declarada em todas as rotas', () => {
  it('acusa uma rota sem @Public, @AnyAuthenticated ou @Roles', () => {
    expect(routesWithoutAuthorization([ControllerEsquecido])).toEqual([
      'ControllerEsquecido.listar',
    ]);
  });

  it('toda rota do AppModule declara quem pode acessá-la', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
    }).compile();

    const controllers = moduleRef
      .get(DiscoveryService)
      .getControllers()
      .map((wrapper) => wrapper.metatype)
      .filter((metatype): metatype is Type => typeof metatype === 'function');

    expect(controllers.length).toBeGreaterThan(0);
    expect(routesWithoutAuthorization(controllers)).toEqual([]);
    await moduleRef.close();
  });
});
