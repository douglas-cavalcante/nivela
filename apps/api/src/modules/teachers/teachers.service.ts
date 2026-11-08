import { Injectable, NotFoundException } from '@nestjs/common';
import type { ApiTeacher, Paginated } from '@nivela/api-contract';
import { hash } from 'bcryptjs';
import { Prisma } from 'src/generated/prisma/client';
import { TokenService } from 'src/modules/auth/token.service';
import { CreateTeacherDto } from 'src/modules/teachers/dto/create-teacher.dto';
import { ListTeachersQuery } from 'src/modules/teachers/dto/list-teachers.query';
import { UpdateTeacherDto } from 'src/modules/teachers/dto/update-teacher.dto';
import { presentTeacher } from 'src/modules/teachers/presenters/teacher.presenter';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';
import { paginate, toPrismaPage } from 'src/shared/pagination/paginate';
import { containsInsensitive } from 'src/shared/prisma/contains-insensitive';
import {
  hasPrismaCode,
  RECORD_NOT_FOUND,
} from 'src/shared/prisma/prisma-error';
import { isUniqueViolation } from 'src/shared/prisma/unique-violation';

const NOT_FOUND = 'Professor não encontrado.';
const EMAIL_TAKEN = 'Este e-mail já está cadastrado.';
const EMAIL_UNIQUE_CONSTRAINT = 'users_email_key';
const BCRYPT_COST = 10;

const WITH_COUNT = { _count: { select: { classrooms: true } } } as const;

@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async list(query: ListTeachersQuery): Promise<Paginated<ApiTeacher>> {
    const where: Prisma.UserWhereInput = {
      role: Role.Teacher,
      ...(query.status ? { active: query.status === 'active' } : {}),
      ...(query.search
        ? {
            OR: [
              { name: containsInsensitive(query.search) },
              { email: containsInsensitive(query.search) },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        include: WITH_COUNT,
        ...toPrismaPage(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(rows.map(presentTeacher), total, query);
  }

  async create(dto: CreateTeacherDto): Promise<ApiTeacher> {
    const password = await hash(dto.password, BCRYPT_COST);
    try {
      const teacher = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password,
          role: Role.Teacher,
        },
        include: WITH_COUNT,
      });
      return presentTeacher(teacher);
    } catch (error) {
      throw this.translate(error);
    }
  }

  async update(id: number, dto: UpdateTeacherDto): Promise<ApiTeacher> {
    try {
      const teacher = await this.prisma.user.update({
        where: { id, role: Role.Teacher },
        data: { name: dto.name, email: dto.email },
        include: WITH_COUNT,
      });
      return presentTeacher(teacher);
    } catch (error) {
      throw this.translate(error);
    }
  }

  /** Desativar apaga todas as sessões na mesma transação; reativar não restaura as antigas. */
  async setStatus(id: number, active: boolean): Promise<ApiTeacher> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const teacher = await tx.user.update({
          where: { id, role: Role.Teacher },
          data: { active },
          include: WITH_COUNT,
        });
        if (!active) {
          await this.tokens.revokeOthers(id, undefined, tx);
        }
        return presentTeacher(teacher);
      });
    } catch (error) {
      throw this.translate(error);
    }
  }

  async resetPassword(id: number, password: string): Promise<void> {
    const passwordHash = await hash(password, BCRYPT_COST);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id, role: Role.Teacher },
          data: { password: passwordHash },
        });
        await this.tokens.revokeOthers(id, undefined, tx);
      });
    } catch (error) {
      throw this.translate(error);
    }
  }

  private translate(error: unknown): unknown {
    if (isUniqueViolation(error, EMAIL_UNIQUE_CONSTRAINT)) {
      return new FieldValidationException({ email: [EMAIL_TAKEN] });
    }
    if (hasPrismaCode(error, RECORD_NOT_FOUND)) {
      return new NotFoundException(NOT_FOUND);
    }
    return error;
  }
}
