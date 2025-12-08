import { UseGuards } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';

@UseGuards(WsJwtGuard)
@WebSocketGateway({ cors: { origin: '*'}})
export class RealtimeGateway {
  @WebSocketServer() server: Server;

  @SubscribeMessage('join:branch')
  handleJoinBranch(@MessageBody() branchId: string, @ConnectedSocket() client: Socket) {
    if (!branchId) return;
    client.join(`room:branch:${branchId}`);
  }

  @SubscribeMessage('leave:branch')
  handleLeaveBranch(@MessageBody() branchId: string, @ConnectedSocket() client: Socket) {
    if (!branchId) return;
    client.leave(`room:branch:${branchId}`);
  }

  // Deprecated: Keep for backward compatibility, but redirect to branch
  @SubscribeMessage('join:hall')
  handleJoinHall(@MessageBody() branchId: string, @ConnectedSocket() client: Socket) {
    if (!branchId) return;
    client.join(`room:branch:${branchId}`);
  }

  @SubscribeMessage('leave:hall')
  handleLeaveHall(@MessageBody() branchId: string, @ConnectedSocket() client: Socket) {
    if (!branchId) return;
    client.leave(`room:branch:${branchId}`);
  }

  @SubscribeMessage('join:booking')
  handleJoinBooking(@MessageBody() bookingId: string, @ConnectedSocket() client: Socket) {
    if (!bookingId) return;
    client.join(`room:booking:${bookingId}`);
  }

  @SubscribeMessage('leave:booking')
  handleLeaveBooking(@MessageBody() bookingId: string, @ConnectedSocket() client: Socket) {
    if (!bookingId) return;
    client.leave(`room:booking:${bookingId}`);
  }

  @SubscribeMessage('join:offers:branch')
  handleJoinOffersBranch(@MessageBody() branchId: string, @ConnectedSocket() client: Socket) {
    if (!branchId) return;
    client.join(`room:offers:branch:${branchId}`);
  }

  @SubscribeMessage('leave:offers:branch')
  handleLeaveOffersBranch(@MessageBody() branchId: string, @ConnectedSocket() client: Socket) {
    if (!branchId) return;
    client.leave(`room:offers:branch:${branchId}`);
  }

  // Emit helpers
  emitBranchUpdated(branchId: string, payload: any) {
    this.server.to(`room:branch:${branchId}`).emit('branch:updated', payload);
  }

  // Deprecated: Keep for backward compatibility
  emitHallUpdated(branchId: string, payload: any) {
    this.server.to(`room:branch:${branchId}`).emit('branch:updated', payload);
  }

  emitBookingUpdated(bookingId: string, payload: any) {
    this.server.to(`room:booking:${bookingId}`).emit('booking:updated', payload);
  }

  emitOffersUpdated(branchId: string, payload: any) {
    this.server.to(`room:offers:branch:${branchId}`).emit('offers:updated', payload);
  }
}


