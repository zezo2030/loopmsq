import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';
import { User } from '../database/entities/user.entity';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([User]),
  ],
  providers: [RealtimeGateway, WsJwtGuard],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
