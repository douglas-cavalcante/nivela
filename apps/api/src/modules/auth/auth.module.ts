import { Module } from '@nestjs/common';
import { AuthController } from 'src/modules/auth/auth.controller';
import { AuthService } from 'src/modules/auth/auth.service';
import { TokenService } from 'src/modules/auth/token.service';
import { ClassroomsModule } from 'src/modules/classrooms/classrooms.module';
import { TOKEN_RESOLVER } from 'src/shared/auth/auth-user';

@Module({
  imports: [ClassroomsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    { provide: TOKEN_RESOLVER, useExisting: TokenService },
  ],
  // O AuthGuard global (registrado no AppModule) resolve tokens por TOKEN_RESOLVER.
  exports: [TokenService, TOKEN_RESOLVER],
})
export class AuthModule {}
