import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers?.authorization;
      const authToken = client.handshake.auth?.token;
      let token = authToken || (authHeader ? authHeader.replace('Bearer ', '') : null);

      if (!token && client.handshake.query?.token) {
        token = client.handshake.query.token as string;
      }

      if (!token) {
        this.logger.warn(`Disconnecting unauthenticated socket ${client.id}`);
        client.disconnect();
        return;
      }

      const secret = process.env.JWT_SECRET || 'super_secret_jwt_key';
      const payload = this.jwtService.verify(token, { secret });
      const userId = payload.sub || payload.id;

      if (!userId) {
        client.disconnect();
        return;
      }

      client.data.userId = userId;
      await client.join(`user_${userId}`);
      this.logger.log(`Socket ${client.id} joined room user_${userId}`);
    } catch (err: any) {
      this.logger.error(`WebSocket connection failed: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Socket ${client.id} disconnected`);
  }

  emitUserBlocked(blockerId: string, blockedId: string) {
    this.server.to(`user_${blockedId}`).emit('user_blocked', { blockerId, blockedId });
    this.server.to(`user_${blockerId}`).emit('user_blocked', { blockerId, blockedId });
  }

  emitUserUnblocked(blockerId: string, blockedId: string) {
    this.server.to(`user_${blockedId}`).emit('user_unblocked', { blockerId, blockedId });
    this.server.to(`user_${blockerId}`).emit('user_unblocked', { blockerId, blockedId });
  }

  emitConversationRead(readerId: string, recipientId: string, conversationId: string) {
    this.server.to(`user_${recipientId}`).emit('conversation_read', {
      conversationId,
      readerId,
    });
  }

  emitPrivacyChanged(userId: string, isPrivate: boolean, followerIds: string[]) {
    for (const followerId of followerIds) {
      this.server.to(`user_${followerId}`).emit('account_privacy_updated', {
        userId,
        isPrivate,
      });
    }
  }

  broadcastNewPostToFollowers(authorId: string, payload: any, followerIds: string[]) {
    for (const followerId of followerIds) {
      this.server.to(`user_${followerId}`).emit('new_post_available', payload);
    }
  }

  sendMessageToUser(recipientId: string, message: any) {
    this.server.to(`user_${recipientId}`).emit('new_message', message);
  }

  sendNotificationToUser(userId: string, notification: any) {
    this.server.to(`user_${userId}`).emit('new_notification', notification);
  }

  emitStoryCreated(authorId: string, payload: any, followerIds: string[]) {
    for (const followerId of followerIds) {
      this.server.to(`user_${followerId}`).emit('story_created', payload);
    }
  }

  emitStoryViewed(storyOwnerId: string, payload: { storyId: string; viewer: any; viewsCount: number }) {
    this.server.to(`user_${storyOwnerId}`).emit('story_viewed', payload);
  }

  emitStoryDeleted(storyId: string, followerIds: string[]) {
    for (const followerId of followerIds) {
      this.server.to(`user_${followerId}`).emit('story_deleted', { storyId });
    }
  }
}
