import { Injectable, NotFoundException } from '@nestjs/common';
import type { ApiCategory } from '@nivela/api-contract';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from 'src/modules/categories/dto/category.dto';
import { presentCategory } from 'src/modules/categories/presenters/category.presenter';
import { PrismaService } from 'src/prisma/prisma.service';
import { BusinessRuleException } from 'src/shared/exceptions/business-rule.exception';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';
import {
  FOREIGN_KEY_VIOLATION,
  hasPrismaCode,
  RECORD_NOT_FOUND,
} from 'src/shared/prisma/prisma-error';
import { isUniqueViolation } from 'src/shared/prisma/unique-violation';

const NOT_FOUND = 'Categoria não encontrada.';
const SUBJECT_NOT_FOUND = 'Disciplina não encontrada.';
const NAME_TAKEN = 'Já existe uma categoria com esse nome nessa disciplina.';
const IN_USE = 'Não é possível excluir: a categoria tem questões.';
// Índice único funcional `(subject_id, lower(name))`, criado à mão na migration.
const NAME_UNIQUE_INDEX = 'categories_subject_name_key';

const WITH_SUBJECT = {
  subject: { select: { id: true, name: true, color: true } },
} as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(subjectId?: number): Promise<ApiCategory[]> {
    const categories = await this.prisma.category.findMany({
      where: subjectId === undefined ? {} : { subjectId },
      orderBy: [{ subject: { name: 'asc' } }, { name: 'asc' }],
      include: WITH_SUBJECT,
    });
    const questions = await this.questionsCountByCategory(
      categories.map((c) => c.id),
    );
    return categories.map((c) => presentCategory(c, questions.get(c.id) ?? 0));
  }

  async create(dto: CreateCategoryDto): Promise<ApiCategory> {
    try {
      const category = await this.prisma.category.create({
        data: { subjectId: dto.subject_id, name: dto.name },
        include: WITH_SUBJECT,
      });
      return presentCategory(category, 0);
    } catch (error) {
      // Disciplina apagada entre a checagem do formulário e a gravação.
      if (hasPrismaCode(error, FOREIGN_KEY_VIOLATION)) {
        throw new FieldValidationException({ subject_id: [SUBJECT_NOT_FOUND] });
      }
      throw this.translate(error);
    }
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<ApiCategory> {
    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: { name: dto.name },
        include: WITH_SUBJECT,
      });
      const questions = await this.questionsCountByCategory([id]);
      return presentCategory(category, questions.get(id) ?? 0);
    } catch (error) {
      throw this.translate(error);
    }
  }

  async remove(id: number): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException(NOT_FOUND);
    }
    const questions = await this.questionsCountByCategory([id]);
    if ((questions.get(id) ?? 0) > 0) {
      throw new BusinessRuleException(IN_USE);
    }
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      // Questão criada entre a checagem e a exclusão: a chave estrangeira decide.
      if (hasPrismaCode(error, FOREIGN_KEY_VIOLATION)) {
        throw new BusinessRuleException(IN_USE);
      }
      throw this.translate(error);
    }
  }

  /**
   * Quantidade de questões por categoria. Ainda não há tabela de questões:
   * a Task 8 troca este corpo por uma contagem agrupada.
   */
  private questionsCountByCategory(
    categoryIds: number[],
  ): Promise<Map<number, number>> {
    void categoryIds;
    return Promise.resolve(new Map());
  }

  private translate(error: unknown): unknown {
    if (isUniqueViolation(error, NAME_UNIQUE_INDEX)) {
      return new FieldValidationException({ name: [NAME_TAKEN] });
    }
    if (hasPrismaCode(error, RECORD_NOT_FOUND)) {
      return new NotFoundException(NOT_FOUND);
    }
    return error;
  }
}
