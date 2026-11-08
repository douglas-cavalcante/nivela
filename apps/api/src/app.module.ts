import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AuthModule } from 'src/modules/auth/auth.module';
import { CategoriesModule } from 'src/modules/categories/categories.module';
import { ClassroomsModule } from 'src/modules/classrooms/classrooms.module';
import { HealthModule } from 'src/modules/health/health.module';
import { SubjectsModule } from 'src/modules/subjects/subjects.module';
import { TeachersModule } from 'src/modules/teachers/teachers.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ClassroomsModule,
    SubjectsModule,
    CategoriesModule,
    TeachersModule,
    HealthModule,
  ],
  providers: [
    // A ordem importa: autentica (preenche request.user) antes de checar o perfil.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
