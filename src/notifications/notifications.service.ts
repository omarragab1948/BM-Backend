import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { BlocksService } from '../blocks/blocks.service';
import { NotificationType } from '@prisma/client';
import { PaginationQueryDto, PaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly blocksService: BlocksService,
  ) {}

  async createNotification(
    userId: string,
    actorId: string,
    type: NotificationType,
    entityId?: string,
  ) {
    if (userId === actorId) return null;

    const isBlocked = await this.blocksService.isBlocked(userId, actorId);
    if (isBlocked) return null;

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        actorId,
        type,
        entityId,
      },
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    this.eventsGateway.sendNotificationToUser(userId, notification);
    return notification;
  }

  async getNotifications(
    userId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<any>> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;

    const blockedIds = await this.blocksService.getBlockedUserIds(userId);

    const where: any = { userId };
    if (blockedIds.length > 0) {
      where.actorId = { notIn: blockedIds };
    }

    const [total, data] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
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

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return { message: 'Notification marked as read' };
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { message: 'All notifications marked as read' };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return { unreadCount: count };
  }
}
