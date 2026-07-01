import { Module } from '@nestjs/common';
import { ReproductiveController } from './reproductive.controller';
import { ReproductiveService } from './reproductive.service';
import { ReproductiveRepository } from './reproductive.repository';

@Module({
  controllers: [ReproductiveController],
  providers: [ReproductiveService, ReproductiveRepository],
  exports: [ReproductiveService],
})
export class ReproductiveModule {}
