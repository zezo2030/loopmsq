import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';

@Module({
  imports: [ConfigModule, JwtModule.register({})],
  providers: [RealtimeGateway, WsJwtGuard],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}


