import { Injectable } from '@nestjs/common';
import type { ImageKind } from 'src/shared/files/image-signature';
import {
  HARD_UPLOAD_LIMIT_BYTES,
  ImageStorageService,
  MAX_IMAGE_BYTES,
  type UploadedImage,
} from 'src/shared/files/image-storage.service';

export { HARD_UPLOAD_LIMIT_BYTES, MAX_IMAGE_BYTES, type UploadedImage };

/** Imagens das questões: o armazenamento compartilhado na pasta `questions/`. */
@Injectable()
export class QuestionImageService {
  constructor(private readonly storage: ImageStorageService) {}

  /** Valida o arquivo (assinatura dos bytes e tamanho) sem tocar o disco. */
  validate(file: UploadedImage | undefined): ImageKind {
    return this.storage.validate(file);
  }

  /** Grava a imagem e devolve o caminho relativo a `UPLOADS_DIR`. */
  save(questionId: number, buffer: Buffer): Promise<string> {
    return this.storage.save('questions', buffer, String(questionId));
  }

  remove(imagePath: string | null): Promise<void> {
    return this.storage.remove(imagePath);
  }

  urlFor(imagePath: string | null): string | null {
    return this.storage.urlFor(imagePath);
  }
}
