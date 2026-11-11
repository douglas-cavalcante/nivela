import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ApiImageUpload,
  ApiQuestion,
  ApiQuestionSummary,
  Paginated,
} from '@nivela/api-contract';
import { Prisma } from 'src/generated/prisma/client';
import { ListQuestionsQuery } from 'src/modules/questions/dto/list-questions.query';
import { QuestionDto } from 'src/modules/questions/dto/question.dto';
import {
  presentQuestion,
  presentQuestionSummary,
} from 'src/modules/questions/presenters/question.presenter';
import {
  QuestionImageService,
  type UploadedImage,
} from 'src/modules/questions/question-image.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';
import { BusinessRuleException } from 'src/shared/exceptions/business-rule.exception';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';
import { paginate, toPrismaPage } from 'src/shared/pagination/paginate';
import { containsInsensitive } from 'src/shared/prisma/contains-insensitive';
import { isForeignKeyViolation } from 'src/shared/prisma/foreign-key-violation';

const NOT_FOUND = 'Questão não encontrada.';
const FORBIDDEN = 'Só o autor ou um administrador pode editar esta questão.';
const SUBJECT_NOT_FOUND = 'Disciplina não encontrada.';
const CATEGORY_NOT_FOUND = 'Categoria não encontrada.';
const CATEGORY_MISMATCH = 'A categoria não pertence à disciplina.';
const IN_PLAN =
  'A questão está em um plano; não é possível trocar a disciplina.';
const ANSWERED =
  'Esta questão já foi respondida; não é possível trocar a alternativa correta.';

const WITH_RELATIONS = {
  subject: { select: { id: true, name: true, color: true } },
  category: { select: { id: true, name: true } },
  author: { select: { id: true, name: true } },
} as const;
const WITH_OPTIONS = { ...WITH_RELATIONS, options: true } as const;

type QuestionRecord = Prisma.QuestionGetPayload<{
  include: typeof WITH_OPTIONS;
}>;

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: QuestionImageService,
  ) {}

  async list(
    query: ListQuestionsQuery,
  ): Promise<Paginated<ApiQuestionSummary>> {
    const where: Prisma.QuestionWhereInput = {
      ...(query.subject_id ? { subjectId: query.subject_id } : {}),
      ...(query.category_id ? { categoryId: query.category_id } : {}),
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      ...(query.status ? { active: query.status === 'active' } : {}),
      ...(query.search ? { statement: containsInsensitive(query.search) } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        include: WITH_RELATIONS,
        ...toPrismaPage(query),
      }),
      this.prisma.question.count({ where }),
    ]);
    return paginate(rows.map(presentQuestionSummary), total, query);
  }

  async findOne(id: number, user: AuthUser): Promise<ApiQuestion> {
    return this.present(await this.load(id), user);
  }

  async create(dto: QuestionDto, user: AuthUser): Promise<ApiQuestion> {
    await this.assertSubjectAndCategory(dto);
    try {
      const question = await this.prisma.question.create({
        data: {
          authorId: user.id,
          subjectId: dto.subject_id,
          categoryId: dto.category_id,
          statement: dto.statement,
          difficulty: dto.difficulty,
          explanation: dto.explanation,
          options: { create: this.optionRows(dto) },
        },
        select: { id: true },
      });
      // Relê fora da escrita: o include dentro da escrita aninhada roda
      // consultas concorrentes na mesma conexão (aviso do pg).
      return this.present(await this.load(question.id), user);
    } catch (error) {
      throw this.translate(error);
    }
  }

  async update(
    id: number,
    dto: QuestionDto,
    user: AuthUser,
  ): Promise<ApiQuestion> {
    const current = await this.load(id);
    this.assertCanEdit(current, user);
    await this.assertSubjectAndCategory(dto);
    try {
      await this.prisma.$transaction(async (tx) => {
        // Trava a linha da questão (única trava desta transação); `POST
        // /answers` e a montagem de capítulos pegam um lock compartilhado
        // nela. Assim, depois deste ponto nenhuma tentativa nova nem vínculo
        // novo com capítulo entra até o fim da transação e as contagens abaixo
        // são definitivas.
        const [locked] = await tx.$queryRaw<{ subject_id: number }[]>`
          SELECT "subject_id" FROM "questions" WHERE "id" = ${id} FOR UPDATE`;
        if (!locked) {
          throw new NotFoundException(NOT_FOUND);
        }
        // O plano é de uma disciplina só: questão de capítulo não troca de
        // disciplina (nem por categoria de outra disciplina, que já cai na
        // checagem de categoria).
        if (
          locked.subject_id !== dto.subject_id &&
          (await tx.chapterQuestion.count({ where: { questionId: id } })) > 0
        ) {
          throw new FieldValidationException({ subject_id: [IN_PLAN] });
        }
        await tx.question.update({
          where: { id },
          data: {
            subjectId: dto.subject_id,
            categoryId: dto.category_id,
            statement: dto.statement,
            difficulty: dto.difficulty,
            explanation: dto.explanation,
          },
          select: { id: true },
        });
        // Política de edição: com tentativas registradas a correta não troca
        // (as respostas e as moedas já pagas dependem dela). A letra correta
        // atual é lida aqui, depois do lock da linha, para que dois PUTs
        // simultâneos não decidam com uma leitura velha. O erro desfaz o
        // update acima.
        const currentCorrect = await tx.questionOption.findFirst({
          where: { questionId: id, isCorrect: true },
          select: { letter: true },
        });
        const changesCorrect = currentCorrect?.letter !== dto.correct_letter;
        if (
          changesCorrect &&
          (await tx.questionAttempt.count({ where: { questionId: id } })) > 0
        ) {
          throw new BusinessRuleException(ANSWERED);
        }
        // As alternativas são atualizadas no lugar (nunca recriadas): as
        // respostas dos alunos apontam para o id delas. Desmarca todas antes
        // de marcar a nova correta para não esbarrar no índice parcial
        // question_options_one_correct_key (uma correta por questão).
        await tx.questionOption.updateMany({
          where: { questionId: id },
          data: { isCorrect: false },
        });
        for (const option of this.optionRows(dto)) {
          await tx.questionOption.update({
            where: {
              questionId_letter: { questionId: id, letter: option.letter },
            },
            data: { text: option.text, isCorrect: option.isCorrect },
            select: { id: true },
          });
        }
      });
      return this.present(await this.load(id), user);
    } catch (error) {
      throw this.translate(error);
    }
  }

  async setStatus(
    id: number,
    active: boolean,
    user: AuthUser,
  ): Promise<ApiQuestion> {
    this.assertCanEdit(await this.load(id), user);
    await this.prisma.question.update({
      where: { id },
      data: { active },
      select: { id: true },
    });
    return this.present(await this.load(id), user);
  }

  /** Valida o arquivo, grava o novo, aponta a questão para ele e só então apaga o antigo. */
  async replaceImage(
    id: number,
    file: UploadedImage | undefined,
    user: AuthUser,
  ): Promise<ApiImageUpload> {
    const question = await this.load(id);
    this.assertCanEdit(question, user);
    const kind = this.images.validate(file);

    const imagePath = await this.images.save(
      id,
      (file as UploadedImage).buffer,
      kind,
    );
    try {
      await this.prisma.question.update({ where: { id }, data: { imagePath } });
    } catch (error) {
      await this.images.remove(imagePath);
      throw this.translate(error);
    }
    await this.images.remove(question.imagePath);
    return { image_url: this.images.urlFor(imagePath) as string };
  }

  async removeImage(id: number, user: AuthUser): Promise<void> {
    const question = await this.load(id);
    this.assertCanEdit(question, user);
    if (!question.imagePath) {
      return;
    }
    await this.prisma.question.update({
      where: { id },
      data: { imagePath: null },
    });
    await this.images.remove(question.imagePath);
  }

  private async load(id: number): Promise<QuestionRecord> {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: WITH_OPTIONS,
    });
    if (!question) {
      throw new NotFoundException(NOT_FOUND);
    }
    return question;
  }

  private canEdit(question: { authorId: number }, user: AuthUser): boolean {
    return user.role === Role.Admin || question.authorId === user.id;
  }

  private assertCanEdit(question: { authorId: number }, user: AuthUser): void {
    if (!this.canEdit(question, user)) {
      throw new ForbiddenException(FORBIDDEN);
    }
  }

  private present(question: QuestionRecord, user: AuthUser): ApiQuestion {
    return presentQuestion(
      question,
      this.images.urlFor(question.imagePath),
      this.canEdit(question, user),
    );
  }

  private optionRows(dto: QuestionDto) {
    return dto.options.map((option) => ({
      letter: option.letter,
      text: option.text,
      isCorrect: option.letter === dto.correct_letter,
    }));
  }

  /** A disciplina existe e a categoria existe e pertence a ela (422 no campo). */
  private async assertSubjectAndCategory(dto: QuestionDto): Promise<void> {
    const [subject, category] = await Promise.all([
      this.prisma.subject.findUnique({
        where: { id: dto.subject_id },
        select: { id: true },
      }),
      this.prisma.category.findUnique({
        where: { id: dto.category_id },
        select: { subjectId: true },
      }),
    ]);
    const errors: Record<string, string[]> = {};
    if (!subject) {
      errors.subject_id = [SUBJECT_NOT_FOUND];
    }
    if (!category) {
      errors.category_id = [CATEGORY_NOT_FOUND];
    } else if (subject && category.subjectId !== subject.id) {
      errors.category_id = [CATEGORY_MISMATCH];
    }
    if (Object.keys(errors).length > 0) {
      throw new FieldValidationException(errors);
    }
  }

  /** Disciplina ou categoria apagada entre a checagem e a gravação → 422 no campo. */
  private translate(error: unknown): unknown {
    if (isForeignKeyViolation(error, 'questions_subject_id_fkey')) {
      return new FieldValidationException({ subject_id: [SUBJECT_NOT_FOUND] });
    }
    if (isForeignKeyViolation(error, 'questions_category_id_fkey')) {
      return new FieldValidationException({
        category_id: [CATEGORY_NOT_FOUND],
      });
    }
    if (isForeignKeyViolation(error, 'questions_category_subject_fkey')) {
      return new FieldValidationException({
        category_id: [CATEGORY_MISMATCH],
      });
    }
    return error;
  }
}
