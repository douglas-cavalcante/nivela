import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuestionDto } from 'src/modules/questions/dto/question.dto';
import { QuestionImageService } from 'src/modules/questions/question-image.service';
import { QuestionsService } from 'src/modules/questions/questions.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';

const author: AuthUser = {
  id: 1,
  name: 'Autora',
  email: 'a@nivela.test',
  role: Role.Teacher,
};
const stranger: AuthUser = { ...author, id: 2 };
const admin: AuthUser = { ...author, id: 3, role: Role.Admin };

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  authorId: 1,
  statement: 'Quanto é 2 + 2?',
  imagePath: null,
  difficulty: 'easy',
  explanation: 'Quatro.',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  subject: { id: 1, name: 'Matemática', color: 'teal' },
  category: { id: 1, name: 'Aritmética' },
  author: { id: 1, name: 'Autora' },
  options: ['A', 'B', 'C', 'D', 'E'].map((letter) => ({
    letter,
    text: letter,
    isCorrect: letter === 'C',
  })),
  ...overrides,
});

const dto = (overrides: Partial<QuestionDto> = {}): QuestionDto => ({
  subject_id: 1,
  category_id: 1,
  statement: 'Quanto é 2 + 2?',
  difficulty: 'easy',
  explanation: 'Quatro.',
  options: ['A', 'B', 'C', 'D', 'E'].map((letter) => ({
    letter: letter as 'A',
    text: letter,
  })),
  correct_letter: 'C',
  ...overrides,
});

async function errorsOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return (
      (error as FieldValidationException).getResponse() as {
        errors: Record<string, string[]>;
      }
    ).errors;
  }
  throw new Error('não lançou');
}

describe('QuestionsService', () => {
  const questionFindUnique = jest.fn();
  const questionCreate = jest.fn();
  const questionUpdate = jest.fn();
  const subjectFindUnique = jest.fn();
  const categoryFindUnique = jest.fn();
  const images = {
    validate: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    urlFor: jest.fn(),
  };
  const service = new QuestionsService(
    {
      question: {
        findUnique: questionFindUnique,
        create: questionCreate,
        update: questionUpdate,
      },
      subject: { findUnique: subjectFindUnique },
      category: { findUnique: categoryFindUnique },
    } as unknown as PrismaService,
    images as unknown as QuestionImageService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    images.urlFor.mockImplementation((p: string | null) =>
      p ? `http://x/uploads/${p}` : null,
    );
    subjectFindUnique.mockResolvedValue({ id: 1 });
    categoryFindUnique.mockResolvedValue({ subjectId: 1 });
  });

  it('findOne: 404 quando não existe; can_edit só para o autor e o admin', async () => {
    questionFindUnique.mockResolvedValueOnce(null);
    await expect(service.findOne(10, author)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    questionFindUnique.mockResolvedValue(row());
    expect((await service.findOne(10, author)).can_edit).toBe(true);
    expect((await service.findOne(10, stranger)).can_edit).toBe(false);
    expect((await service.findOne(10, admin)).can_edit).toBe(true);
  });

  it('create: marca só a alternativa correta e usa o usuário como autor', async () => {
    questionCreate.mockResolvedValue({ id: 10 });
    questionFindUnique.mockResolvedValue(row());

    const created = await service.create(dto(), author);

    expect(created.correct_letter).toBe('C');
    const { data } = questionCreate.mock.calls[0][0] as {
      data: {
        authorId: number;
        options: { create: Array<{ letter: string; isCorrect: boolean }> };
      };
    };
    expect(data.authorId).toBe(1);
    expect(
      data.options.create.filter((o) => o.isCorrect).map((o) => o.letter),
    ).toEqual(['C']);
  });

  it('create: disciplina inexistente → 422 em subject_id, sem gravar', async () => {
    subjectFindUnique.mockResolvedValue(null);
    expect(await errorsOf(service.create(dto(), author))).toEqual({
      subject_id: ['Disciplina não encontrada.'],
    });
    expect(questionCreate).not.toHaveBeenCalled();
  });

  it('create: categoria de outra disciplina → 422 em category_id, sem gravar', async () => {
    categoryFindUnique.mockResolvedValue({ subjectId: 2 });
    expect(await errorsOf(service.create(dto(), author))).toEqual({
      category_id: ['A categoria não pertence à disciplina.'],
    });
    expect(questionCreate).not.toHaveBeenCalled();
  });

  it('update e status: 403 para quem não é autor nem admin', async () => {
    questionFindUnique.mockResolvedValue(row());
    await expect(service.update(10, dto(), stranger)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.setStatus(10, false, stranger)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(questionUpdate).not.toHaveBeenCalled();
  });

  it('replaceImage: valida antes de gravar e apaga a imagem antiga depois', async () => {
    questionFindUnique.mockResolvedValue(
      row({ imagePath: 'questions/old.png' }),
    );
    images.validate.mockReturnValue('png');
    images.save.mockResolvedValue('questions/new.png');
    questionUpdate.mockResolvedValue({});

    const result = await service.replaceImage(10, { buffer: PNG }, author);

    expect(result).toEqual({ image_url: 'http://x/uploads/questions/new.png' });
    expect(images.remove).toHaveBeenCalledWith('questions/old.png');
    expect(images.remove).not.toHaveBeenCalledWith('questions/new.png');
  });

  it('replaceImage: arquivo inválido não grava nada', async () => {
    questionFindUnique.mockResolvedValue(row());
    images.validate.mockImplementation(() => {
      throw new FieldValidationException({ image: ['Envie uma imagem.'] });
    });

    await expect(
      service.replaceImage(10, undefined, author),
    ).rejects.toBeInstanceOf(FieldValidationException);
    expect(images.save).not.toHaveBeenCalled();
  });

  it('replaceImage: se o banco falha, apaga o arquivo novo e mantém o antigo', async () => {
    questionFindUnique.mockResolvedValue(
      row({ imagePath: 'questions/old.png' }),
    );
    images.validate.mockReturnValue('png');
    images.save.mockResolvedValue('questions/new.png');
    questionUpdate.mockRejectedValue(new Error('banco fora do ar'));

    await expect(
      service.replaceImage(10, { buffer: PNG }, author),
    ).rejects.toThrow('banco fora do ar');
    expect(images.remove).toHaveBeenCalledTimes(1);
    expect(images.remove).toHaveBeenCalledWith('questions/new.png');
  });

  it('replaceImage: 403 antes de olhar o arquivo', async () => {
    questionFindUnique.mockResolvedValue(row());
    await expect(
      service.replaceImage(10, { buffer: PNG }, stranger),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(images.validate).not.toHaveBeenCalled();
  });
});
