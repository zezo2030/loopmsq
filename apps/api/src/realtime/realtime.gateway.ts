import { UseGuards } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';

@UseGuards(WsJwtGuard)
@WebSocketGateway({ cors: { origin: '*'}})
export class RealtimeGateway {
  @WebSocketServer() server: Server;

  @SubscribeMessage('join:hall')
  handleJoinHall(@MessageBody() hallId: string, @ConnectedSocket() client: Socket) {
    if (!hallId) return;
    client.join(`room:hall:${hallId}`);
  }

  @SubscribeMessage('leave:hall')
  handleLeaveHall(@MessageBody() hallId: string, @ConnectedSocket() client: Socket) {
    if (!hallId) return;
    client.leave(`room:hall:${hallId}`);
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
  emitHallUpdated(hallId: string, payload: any) {
    this.server.to(`room:hall:${hallId}`).emit('hall:updated', payload);
  }

  emitBookingUpdated(bookingId: string, payload: any) {
    this.server.to(`room:booking:${bookingId}`).emit('booking:updated', payload);
  }

  emitOffersUpdated(branchId: string, payload: any) {
    this.server.to(`room:offers:branch:${branchId}`).emit('offers:updated', payload);
  }
}


