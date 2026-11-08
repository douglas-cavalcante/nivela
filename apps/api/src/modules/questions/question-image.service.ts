import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';
import {
  type ImageKind,
  isAllowedImage,
} from 'src/shared/files/image-signature';
import {
  publicUrl,
  UPLOADS_PREFIX,
  uploadsDir,
} from 'src/shared/files/uploads-config';

/** Limite de negócio da imagem de uma questão. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
/** Limite duro do multer: acima disso a requisição já é recusada (413). */
export const HARD_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024;

const MISSING = 'Envie uma imagem.';
const WRONG_TYPE = 'Envie uma imagem JPG, PNG ou WEBP.';
const TOO_BIG = 'A imagem deve ter no máximo 2 MB.';

/** O que a rota de upload precisa do arquivo (multer em memória). */
export interface UploadedImage {
  buffer: Buffer;
}

/** Grava e apaga as imagens das questões em `UPLOADS_DIR/questions`. */
@Injectable()
export class QuestionImageService {
  private readonly logger = new Logger(QuestionImageService.name);

  /** Valida o arquivo (assinatura dos bytes e tamanho) sem tocar o disco. */
  validate(file: UploadedImage | undefined): ImageKind {
    if (!file?.buffer?.length) {
      throw new FieldValidationException({ image: [MISSING] });
    }
    const kind = isAllowedImage(file.buffer);
    if (!kind) {
      throw new FieldValidationException({ image: [WRONG_TYPE] });
    }
    if (file.buffer.length > MAX_IMAGE_BYTES) {
      throw new FieldValidationException({ image: [TOO_BIG] });
    }
    return kind;
  }

  /** Grava a imagem e devolve o caminho relativo a `UPLOADS_DIR`. */
  async save(
    questionId: number,
    buffer: Buffer,
    kind: ImageKind,
  ): Promise<string> {
    const relative = `questions/${questionId}-${randomUUID()}.${kind}`;
    const target = join(uploadsDir(), relative);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, buffer);
    return relative;
  }

  /** Apaga o arquivo (não falha se ele já não existir). */
  async remove(imagePath: string | null): Promise<void> {
    if (!imagePath) {
      return;
    }
    const root = uploadsDir();
    const target = resolve(root, imagePath);
    // Nunca apaga fora da pasta de uploads, mesmo com um caminho adulterado no banco.
    if (!target.startsWith(root + sep)) {
      return;
    }
    try {
      await rm(target, { force: true });
    } catch (error) {
      // O banco já aponta para outro lugar: um arquivo órfão não deve virar 500.
      this.logger.warn(
        `Não foi possível apagar ${imagePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** URL pública da imagem, ou null se a questão não tem. */
  urlFor(imagePath: string | null): string | null {
    return imagePath ? `${publicUrl()}${UPLOADS_PREFIX}/${imagePath}` : null;
  }
}
