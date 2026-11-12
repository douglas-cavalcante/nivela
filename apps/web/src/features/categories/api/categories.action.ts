import type { ApiCategory } from '@nivela/api-contract';
import * as categoriesApi from 'src/features/categories/api/categories.api';

/** `subjectId` vazio ('') não vai para a API: lista de todas as disciplinas. */
export const listCategoriesAction = async (subjectId: string, signal?: AbortSignal): Promise<ApiCategory[]> =>
  (await categoriesApi.listCategories(subjectId ? { subject_id: Number(subjectId) } : {}, signal)).data.data;

export const createCategoryAction = async (data: { name: string; subject_id: number }): Promise<ApiCategory> =>
  (await categoriesApi.createCategory(data)).data;

export const updateCategoryAction = async (id: number, data: { name: string }): Promise<ApiCategory> =>
  (await categoriesApi.updateCategory(id, data)).data;

export const deleteCategoryAction = async (id: number): Promise<void> => {
  await categoriesApi.deleteCategory(id);
};
