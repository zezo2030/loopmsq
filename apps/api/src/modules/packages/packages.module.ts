import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventPackage } from '../../database/entities/event-package.entity';
import { PackagesService } from './packages.service';
import { PackagesController } from './packages.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EventPackage])],
  controllers: [PackagesController],
  providers: [PackagesService],
  exports: [PackagesService],
})
export class PackagesModule {}


