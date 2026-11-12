import { Injectable, NotFoundException } from '@nestjs/common';
import type { ApiSubject } from '@nivela/api-contract';
import { SubjectDto } from 'src/modules/subjects/dto/subject.dto';
import { presentSubject } from 'src/modules/subjects/presenters/subject.presenter';
import { PrismaService } from 'src/prisma/prisma.service';
import { BusinessRuleException } from 'src/shared/exceptions/business-rule.exception';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';
import {
  FOREIGN_KEY_VIOLATION,
  hasPrismaCode,
  RECORD_NOT_FOUND,
} from 'src/shared/prisma/prisma-error';
import { isUniqueViolation } from 'src/shared/prisma/unique-violation';

const NOT_FOUND = 'Disciplina não encontrada.';
const NAME_TAKEN = 'Já existe uma disciplina com esse nome.';
const IN_USE =
  'Não é possível excluir: a disciplina tem categorias ou questões.';
// Índice único funcional `lower(name)`, criado à mão na migration.
const NAME_UNIQUE_INDEX = 'subjects_name_key';

const WITH_COUNTS = { _count: { select: { categories: true } } } as const;

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<ApiSubject[]> {
    const subjects = await this.prisma.subject.findMany({
      orderBy: { name: 'asc' },
      include: WITH_COUNTS,
    });
    const questions = await this.questionsCountBySubject(
      subjects.map((s) => s.id),
    );
    return subjects.map((s) => presentSubject(s, questions.get(s.id) ?? 0));
  }

  async create(dto: SubjectDto): Promise<ApiSubject> {
    try {
      const subject = await this.prisma.subject.create({
        data: { name: dto.name, color: dto.color, icon: dto.icon },
        include: WITH_COUNTS,
      });
      return presentSubject(subject, 0);
    } catch (error) {
      throw this.translate(error);
    }
  }

  async update(id: number, dto: SubjectDto): Promise<ApiSubject> {
    try {
      const subject = await this.prisma.subject.update({
        where: { id },
        data: { name: dto.name, color: dto.color, icon: dto.icon },
        include: WITH_COUNTS,
      });
      const questions = await this.questionsCountBySubject([id]);
      return presentSubject(subject, questions.get(id) ?? 0);
    } catch (error) {
      throw this.translate(error);
    }
  }

  async remove(id: number): Promise<void> {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: WITH_COUNTS,
    });
    if (!subject) {
      throw new NotFoundException(NOT_FOUND);
    }
    const questions = await this.questionsCountBySubject([id]);
    if (subject._count.categories > 0 || (questions.get(id) ?? 0) > 0) {
      throw new BusinessRuleException(IN_USE);
    }
    try {
      await this.prisma.subject.delete({ where: { id } });
    } catch (error) {
      // Categoria criada entre a checagem e a exclusão: a chave estrangeira decide.
      throw this.translate(error);
    }
  }

  /** Quantidade de questões (ativas ou não) por disciplina. */
  private async questionsCountBySubject(
    subjectIds: number[],
  ): Promise<Map<number, number>> {
    const groups = await this.prisma.question.groupBy({
      by: ['subjectId'],
      where: { subjectId: { in: subjectIds } },
      _count: { _all: true },
    });
    return new Map(groups.map((g) => [g.subjectId, g._count._all]));
  }

  private translate(error: unknown): unknown {
    if (isUniqueViolation(error, NAME_UNIQUE_INDEX)) {
      return new FieldValidationException({ name: [NAME_TAKEN] });
    }
    if (hasPrismaCode(error, RECORD_NOT_FOUND)) {
      return new NotFoundException(NOT_FOUND);
    }
    if (hasPrismaCode(error, FOREIGN_KEY_VIOLATION)) {
      return new BusinessRuleException(IN_USE);
    }
    return error;
  }
}
