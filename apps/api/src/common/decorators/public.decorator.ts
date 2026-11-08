import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca a rota como pública (o guard de autenticação global a ignora). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
