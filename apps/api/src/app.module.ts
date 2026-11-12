import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AnswersModule } from 'src/modules/answers/answers.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { CategoriesModule } from 'src/modules/categories/categories.module';
import { ClassroomsModule } from 'src/modules/classrooms/classrooms.module';
import { DashboardModule } from 'src/modules/dashboard/dashboard.module';
import { HealthModule } from 'src/modules/health/health.module';
import { LevelingPlansModule } from 'src/modules/leveling-plans/leveling-plans.module';
import { RewardsModule } from 'src/modules/rewards/rewards.module';
import { QuestionsModule } from 'src/modules/questions/questions.module';
import { StudentsModule } from 'src/modules/students/students.module';
import { SubjectsModule } from 'src/modules/subjects/subjects.module';
import { TeachersModule } from 'src/modules/teachers/teachers.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ClockModule } from 'src/shared/clock/clock.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ClockModule,
    AuthModule,
    ClassroomsModule,
    SubjectsModule,
    CategoriesModule,
    TeachersModule,
    StudentsModule,
    QuestionsModule,
    AnswersModule,
    LevelingPlansModule,
    RewardsModule,
    DashboardModule,
    HealthModule,
  ],
  providers: [
    // A ordem importa: autentica (preenche request.user) antes de checar o perfil.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
