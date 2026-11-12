import { Module } from '@nestjs/common';
import { ImageStorageService } from 'src/shared/files/image-storage.service';

@Module({
  providers: [ImageStorageService],
  exports: [ImageStorageService],
})
export class FilesModule {}
