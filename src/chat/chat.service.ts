import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { EventsGateway } from '../events/events.gateway';
import { BlocksService } from '../blocks/blocks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SendMessageDto } from './dto/send-message.dto';
import { NotificationType } from '@prisma/client';
import { PaginationQueryDto, PaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly eventsGateway: EventsGateway,
    private readonly blocksService: BlocksService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async getOrCreateConversation(userAId: string, userBId: string) {
    const [user1Id, user2Id] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];

    let conversation = await this.prisma.conversation.findUnique({
      where: {
        user1Id_user2Id: { user1Id, user2Id },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { user1Id, user2Id },
      });
    }

    return conversation;
  }

  async sendMessage(
    senderId: string,
    dto: SendMessageDto,
    file?: Express.Multer.File,
  ) {
    if (senderId === dto.recipientId) {
      throw new BadRequestException('You cannot send messages to yourself');
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: dto.recipientId },
    });

    if (!recipient) {
      throw new NotFoundException('Recipient user not found');
    }

    const isBlocked = await this.blocksService.isBlocked(senderId, dto.recipientId);
    if (isBlocked) {
      throw new ForbiddenException('Cannot send messages to a blocked user');
    }

    let mediaUrl: string | undefined = undefined;
    if (file) {
      const uploadResult = await this.cloudinary.uploadFile(file, 'chat');
      mediaUrl = uploadResult.secure_url;
    }

    const conversation = await this.getOrCreateConversation(senderId, dto.recipientId);

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        content: dto.content,
        mediaUrl,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    this.eventsGateway.sendMessageToUser(dto.recipientId, message);

    await this.notificationsService.createNotification(
      dto.recipientId,
      senderId,
      NotificationType.NEW_MESSAGE,
      message.id,
    );

    return message;
  }

  async getConversations(userId: string) {
    const blockedIds = await this.blocksService.getBlockedUserIds(userId);

    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
        AND: [
          { user1Id: { notIn: blockedIds } },
          { user2Id: { notIn: blockedIds } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        user1: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        user2: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            content: true,
            mediaUrl: true,
            senderId: true,
            isRead: true,
            createdAt: true,
          },
        },
      },
    });

    const result = await Promise.all(
      conversations.map(async (c) => {
        const otherUser = c.user1Id === userId ? c.user2 : c.user1;
        const lastMessage = c.messages[0] || null;

        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: c.id,
            senderId: { not: userId },
            isRead: false,
          },
        });

        return {
          id: c.id,
          recipient: otherUser,
          lastMessage,
          unreadCount,
          updatedAt: c.updatedAt,
        };
      }),
    );

    return result;
  }

  async getMessages(
    userId: string,
    recipientId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<any>> {
    const isBlocked = await this.blocksService.isBlocked(userId, recipientId);
    if (isBlocked) {
      throw new ForbiddenException('Cannot view messages of a blocked user');
    }

    const conversation = await this.getOrCreateConversation(userId, recipientId);

    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const where = { conversationId: conversation.id };

    const [total, messages] = await Promise.all([
      this.prisma.message.count({ where }),
      this.prisma.message.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      }),
    ]);

    const updatedBatch = await this.prisma.message.updateMany({
      where: {
        conversationId: conversation.id,
        senderId: recipientId,
        isRead: false,
      },
      data: { isRead: true },
    });

    if (updatedBatch.count > 0) {
      this.eventsGateway.emitConversationRead(userId, recipientId, conversation.id);
    }

    const totalPages = Math.ceil(total / limit);

    return {
      data: messages.reverse(),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async markConversationAsRead(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException('Access denied to conversation');
    }

    const otherUserId = conversation.user1Id === userId ? conversation.user2Id : conversation.user1Id;

    const updatedBatch = await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });

    if (updatedBatch.count > 0) {
      this.eventsGateway.emitConversationRead(userId, otherUserId, conversation.id);
    }

    return { message: 'Conversation marked as read' };
  }
}
