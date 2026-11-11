import { PrismaService } from 'src/prisma/prisma.service';
import { createCategory, createQuestion } from './factories';

interface PlanOptions {
  teacherId: number;
  subjectId: number;
  /** Número de questões de cada capítulo, na ordem. */
  chapters: number[];
  title?: string;
  status?: 'draft' | 'published';
  completionBonus?: number;
}

/** Plano criado direto no banco, com capítulos e questões ativas na ordem. */
export async function createPlan(prisma: PrismaService, options: PlanOptions) {
  const category = await createCategory(prisma, {
    subjectId: options.subjectId,
  });
  const plan = await prisma.levelingPlan.create({
    data: {
      teacherId: options.teacherId,
      subjectId: options.subjectId,
      title: options.title ?? 'Plano de frações',
      status: options.status ?? 'published',
      completionBonus: options.completionBonus ?? 50,
    },
  });
  const chapters: Array<{ id: number; questions: number[] }> = [];
  for (const [index, count] of options.chapters.entries()) {
    const chapter = await prisma.planChapter.create({
      data: {
        levelingPlanId: plan.id,
        title: `Capítulo ${index + 1}`,
        position: index + 1,
      },
    });
    const questions: number[] = [];
    for (let position = 1; position <= count; position++) {
      const question = await createQuestion(prisma, {
        subjectId: options.subjectId,
        categoryId: category.id,
      });
      await prisma.chapterQuestion.create({
        data: { planChapterId: chapter.id, questionId: question.id, position },
      });
      questions.push(question.id);
    }
    chapters.push({ id: chapter.id, questions });
  }
  return { planId: plan.id, chapters };
}
