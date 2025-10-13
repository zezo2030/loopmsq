import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from '../../database/entities/user.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { EncryptionService } from '../../utils/encryption.util';
import { AdminSeeder } from './admin.seeder';

@Module({
  imports: [TypeOrmModule.forFeature([User, Wallet])],
  controllers: [UsersController],
  providers: [UsersService, EncryptionService, AdminSeeder],
  exports: [UsersService],
})
export class UsersModule {}
