import { Injectable } from '@nestjs/common';
import type { ImageKind } from 'src/shared/files/image-signature';
import {
  ImageStorageService,
  type UploadedImage,
} from 'src/shared/files/image-storage.service';

/** Imagens dos prêmios: o armazenamento compartilhado na pasta `rewards/`. */
@Injectable()
export class RewardImageService {
  constructor(private readonly storage: ImageStorageService) {}

  validate(file: UploadedImage | undefined): ImageKind {
    return this.storage.validate(file);
  }

  /** Grava a imagem e devolve o caminho relativo a `UPLOADS_DIR`. */
  save(rewardId: number, buffer: Buffer): Promise<string> {
    return this.storage.save('rewards', buffer, String(rewardId));
  }

  remove(imagePath: string | null): Promise<void> {
    return this.storage.remove(imagePath);
  }

  urlFor(imagePath: string | null): string | null {
    return this.storage.urlFor(imagePath);
  }
}
