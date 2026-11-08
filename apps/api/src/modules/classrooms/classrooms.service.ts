import { Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import type {
  ApiClassroom,
  ApiClassroomSummary,
  ApiStudent,
  Paginated,
} from '@nivela/api-contract';
import { Prisma } from 'src/generated/prisma/client';
import { classroomScope } from 'src/shared/scopes/classroom-scope';
import { CreateClassroomStudentDto } from 'src/modules/classrooms/dto/create-classroom-student.dto';
import { CreateClassroomDto } from 'src/modules/classrooms/dto/create-classroom.dto';
import { ListClassroomsQuery } from 'src/modules/classrooms/dto/list-classrooms.query';
import { UpdateClassroomDto } from 'src/modules/classrooms/dto/update-classroom.dto';
import { JoinCodeService } from 'src/modules/classrooms/join-code.service';
import {
  presentClassroom,
  presentClassroomSummary,
} from 'src/modules/classrooms/presenters/classroom.presenter';
import { StudentsService } from 'src/modules/students/students.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';
import { paginate, toPrismaPage } from 'src/shared/pagination/paginate';
import { containsInsensitive } from 'src/shared/prisma/contains-insensitive';
import {
  hasPrismaCode,
  RECORD_NOT_FOUND,
} from 'src/shared/prisma/prisma-error';
import { isUniqueViolation } from 'src/shared/prisma/unique-violation';
import { BCRYPT_COST } from 'src/shared/security/password';

const NOT_FOUND = 'Turma não encontrada.';
const STUDENT_NOT_IN_CLASSROOM = 'Aluno não encontrado nesta turma.';
const EMAIL_TAKEN =
  'Este e-mail já está cadastrado. O aluno pode entrar na turma pelo código.';
// Restrição única do e-mail em `users` (nome gerado pela migration).
const EMAIL_UNIQUE_CONSTRAINT = 'users_email_key';

const SUMMARY_INCLUDE = {
  teacher: { select: { id: true, name: true } },
  _count: { select: { students: true } },
} as const;

const DETAIL_INCLUDE = {
  ...SUMMARY_INCLUDE,
  students: {
    select: {
      joinedAt: true,
      student: {
        select: { id: true, name: true, email: true, active: true },
      },
    },
    orderBy: [{ student: { name: 'asc' } }, { studentId: 'asc' }],
  },
} satisfies Prisma.ClassroomInclude;

@Injectable()
export class ClassroomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly joinCodes: JoinCodeService,
    private readonly students: StudentsService,
  ) {}

  async list(
    query: ListClassroomsQuery,
    user: AuthUser,
  ): Promise<Paginated<ApiClassroomSummary>> {
    const filters: Prisma.ClassroomWhereInput = {
      ...(query.status ? { active: query.status === 'active' } : {}),
      ...(query.search ? { name: containsInsensitive(query.search) } : {}),
    };
    const where: Prisma.ClassroomWhereInput = {
      AND: [classroomScope(user), filters],
    };
    const [rows, total] = await Promise.all([
      this.prisma.classroom.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        include: SUMMARY_INCLUDE,
        ...toPrismaPage(query),
      }),
      this.prisma.classroom.count({ where }),
    ]);
    return paginate(rows.map(presentClassroomSummary), total, query);
  }

  async findOne(id: number, user: AuthUser): Promise<ApiClassroom> {
    const classroom = await this.prisma.classroom.findFirst({
      where: { AND: [{ id }, classroomScope(user)] },
      include: DETAIL_INCLUDE,
    });
    if (!classroom) {
      throw new NotFoundException(NOT_FOUND);
    }
    return presentClassroom(classroom);
  }

  async create(dto: CreateClassroomDto, user: AuthUser): Promise<ApiClassroom> {
    const teacherId = await this.resolveTeacherId(dto, user);
    const classroom = await this.joinCodes.createWithUniqueCode({
      teacherId,
      name: dto.name,
      schoolYear: dto.school_year ?? null,
    });
    return this.findOne(classroom.id, user);
  }

  async update(
    id: number,
    dto: UpdateClassroomDto,
    user: AuthUser,
  ): Promise<ApiClassroom> {
    await this.assertVisible(id, user);
    try {
      await this.prisma.classroom.update({
        where: { id },
        data: {
          name: dto.name,
          // undefined = não mexe; null = limpa o ano letivo.
          schoolYear: dto.school_year,
          active: dto.active,
        },
      });
    } catch (error) {
      throw this.translate(error);
    }
    return this.findOne(id, user);
  }

  /** Gera outro código; o anterior deixa de valer imediatamente. */
  async regenerateJoinCode(
    id: number,
    user: AuthUser,
  ): Promise<{ join_code: string }> {
    await this.assertVisible(id, user);
    try {
      return { join_code: await this.joinCodes.regenerate(id) };
    } catch (error) {
      throw this.translate(error);
    }
  }

  /**
   * Matrícula manual: cria usuário, perfil e matrícula na mesma transação. O
   * aluno já pode entrar no aplicativo com o e-mail e a senha informados.
   */
  async addStudent(
    id: number,
    dto: CreateClassroomStudentDto,
    user: AuthUser,
  ): Promise<ApiStudent> {
    await this.assertVisible(id, user);

    const emailTaken = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (emailTaken) {
      throw new FieldValidationException({ email: [EMAIL_TAKEN] });
    }

    const password = await hash(dto.password, BCRYPT_COST);
    try {
      const studentId = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            password,
            role: Role.Student,
          },
          select: { id: true },
        });
        await tx.studentProfile.create({ data: { userId: created.id } });
        await tx.classroomStudent.create({
          data: { classroomId: id, studentId: created.id },
        });
        return created.id;
      });
      return await this.students.findOne(studentId, user);
    } catch (error) {
      // Cadastros simultâneos com o mesmo e-mail: a unicidade do banco decide.
      if (isUniqueViolation(error, EMAIL_UNIQUE_CONSTRAINT)) {
        throw new FieldValidationException({ email: [EMAIL_TAKEN] });
      }
      throw this.translate(error);
    }
  }

  /** Só desmatricula: a conta e o progresso do aluno continuam. */
  async removeStudent(
    id: number,
    studentId: number,
    user: AuthUser,
  ): Promise<void> {
    await this.assertVisible(id, user);
    const { count } = await this.prisma.classroomStudent.deleteMany({
      where: { classroomId: id, studentId },
    });
    if (count === 0) {
      throw new NotFoundException(STUDENT_NOT_IN_CLASSROOM);
    }
  }

  /**
   * Turma que aceita novos alunos pelo código (já normalizado). Compartilhado
   * entre o cadastro do aluno e `POST /me/classrooms`; `client` permite
   * consultar dentro de uma transação.
   */
  async findJoinable(
    joinCode: string,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const classroom = await client.classroom.findUnique({
      where: { joinCode },
      select: {
        id: true,
        name: true,
        schoolYear: true,
        active: true,
        teacher: { select: { name: true } },
      },
    });
    if (!classroom) {
      throw new FieldValidationException({
        join_code: ['Código de turma inválido.'],
      });
    }
    if (!classroom.active) {
      throw new FieldValidationException({
        join_code: ['Esta turma não está aceitando novos alunos.'],
      });
    }
    return classroom;
  }

  /** 404 quando a turma não existe ou não é visível para quem pede. */
  private async assertVisible(id: number, user: AuthUser): Promise<void> {
    const classroom = await this.prisma.classroom.findFirst({
      where: { AND: [{ id }, classroomScope(user)] },
      select: { id: true },
    });
    if (!classroom) {
      throw new NotFoundException(NOT_FOUND);
    }
  }

  private async resolveTeacherId(
    dto: CreateClassroomDto,
    user: AuthUser,
  ): Promise<number> {
    if (user.role !== Role.Admin) {
      return user.id;
    }
    if (dto.teacher_id === undefined || dto.teacher_id === null) {
      throw new FieldValidationException({
        teacher_id: ['Informe o professor da turma.'],
      });
    }
    const teacher = await this.prisma.user.findFirst({
      where: { id: dto.teacher_id, role: Role.Teacher },
      select: { id: true },
    });
    if (!teacher) {
      throw new FieldValidationException({
        teacher_id: ['Professor não encontrado.'],
      });
    }
    return teacher.id;
  }

  private translate(error: unknown): unknown {
    return hasPrismaCode(error, RECORD_NOT_FOUND)
      ? new NotFoundException(NOT_FOUND)
      : error;
  }
}
