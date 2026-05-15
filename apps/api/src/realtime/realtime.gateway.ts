import { UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';
import { User } from '../database/entities/user.entity';

@UseGuards(WsJwtGuard)
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway {
  @WebSocketServer() server: Server;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @SubscribeMessage('join:branch')
  handleJoinBranch(
    @MessageBody() branchId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!branchId) return;
    client.join(`room:branch:${branchId}`);
  }

  @SubscribeMessage('leave:branch')
  handleLeaveBranch(
    @MessageBody() branchId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!branchId) return;
    client.leave(`room:branch:${branchId}`);
  }

  // Deprecated: Keep for backward compatibility, but redirect to branch
  @SubscribeMessage('join:hall')
  handleJoinHall(
    @MessageBody() branchId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!branchId) return;
    client.join(`room:branch:${branchId}`);
  }

  @SubscribeMessage('leave:hall')
  handleLeaveHall(
    @MessageBody() branchId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!branchId) return;
    client.leave(`room:branch:${branchId}`);
  }

  @SubscribeMessage('join:booking')
  handleJoinBooking(
    @MessageBody() bookingId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!bookingId) return;
    client.join(`room:booking:${bookingId}`);
  }

  @SubscribeMessage('leave:booking')
  handleLeaveBooking(
    @MessageBody() bookingId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!bookingId) return;
    client.leave(`room:booking:${bookingId}`);
  }

  @SubscribeMessage('join:offers:branch')
  handleJoinOffersBranch(
    @MessageBody() branchId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!branchId) return;
    client.join(`room:offers:branch:${branchId}`);
  }

  @SubscribeMessage('leave:offers:branch')
  handleLeaveOffersBranch(
    @MessageBody() branchId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!branchId) return;
    client.leave(`room:offers:branch:${branchId}`);
  }

  // Admin/branch-manager notification room. JWT payload was attached by
  // WsJwtGuard; only admins join the global admin room, branch managers join
  // their branch-scoped room.
  @SubscribeMessage('join:admin')
  async handleJoinAdmin(@ConnectedSocket() client: Socket) {
    const payload = (client as any).user || {};
    const roles: string[] = payload.roles || [];
    const isAdmin = roles.includes('admin');
    const isBranchManager = roles.includes('branch_manager');
    if (!isAdmin && !isBranchManager) return;

    if (isAdmin) {
      client.join('room:admin');
    }
    if (isBranchManager) {
      // Resolve branchId from DB since JWT does not carry it.
      try {
        const user = await this.userRepo.findOne({ where: { id: payload.sub } });
        if (user?.branchId) {
          client.join(`room:admin:branch:${user.branchId}`);
        }
      } catch {
        // ignore — fall through without branch room
      }
    }
  }

  @SubscribeMessage('leave:admin')
  handleLeaveAdmin(@ConnectedSocket() client: Socket) {
    client.leave('room:admin');
    // Leave any branch-scoped admin rooms this socket joined
    for (const r of client.rooms) {
      if (typeof r === 'string' && r.startsWith('room:admin:branch:')) {
        client.leave(r);
      }
    }
  }

  // Emit helpers
  emitBranchUpdated(branchId: string, payload: any) {
    this.server.to(`room:branch:${branchId}`).emit('branch:updated', payload);
  }

  emitAdminNotification(payload: any) {
    // Global admin firehose
    this.server.to('room:admin').emit('admin:notification', payload);
    // Branch-scoped fan-out so branch managers receive only their own
    const branchId = payload?.branchId;
    if (branchId) {
      this.server
        .to(`room:admin:branch:${branchId}`)
        .emit('admin:notification', payload);
    }
  }

  // Deprecated: Keep for backward compatibility
  emitHallUpdated(branchId: string, payload: any) {
    this.server.to(`room:branch:${branchId}`).emit('branch:updated', payload);
  }

  emitBookingUpdated(bookingId: string, payload: any) {
    this.server
      .to(`room:booking:${bookingId}`)
      .emit('booking:updated', payload);
  }

  emitOffersUpdated(branchId: string, payload: any) {
    this.server
      .to(`room:offers:branch:${branchId}`)
      .emit('offers:updated', payload);
  }
}
