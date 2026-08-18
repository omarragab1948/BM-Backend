import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto, PaginatedResult } from '../common/dto/pagination.dto';

import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';
import { BlocksService } from '../blocks/blocks.service';

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocksService: BlocksService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const isBlocked = await this.blocksService.isBlocked(followerId, followingId);
    if (isBlocked) {
      throw new ForbiddenException('Cannot follow a blocked user or a user who blocked you');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: followingId },
    });

    if (!targetUser) {
      throw new NotFoundException('User to follow not found');
    }

    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId },
      },
    });

    if (existingFollow) {
      throw new BadRequestException(`Already following or request is pending`);
    }

    const status = targetUser.isPrivate ? 'PENDING' : 'ACCEPTED';

    const follow = await this.prisma.follow.create({
      data: {
        followerId,
        followingId,
        status,
      },
    });

    const notifType = targetUser.isPrivate
      ? NotificationType.FOLLOW_REQUEST
      : NotificationType.FOLLOW_ACCEPT;

    await this.notificationsService.createNotification(
      followingId,
      followerId,
      notifType,
      follow.id,
    );

    return {
      message: targetUser.isPrivate
        ? 'Follow request sent to private profile'
        : 'Successfully followed user',
      follow,
    };
  }

  async unfollowUser(followerId: string, followingId: string) {
    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId },
      },
    });

    if (!existingFollow) {
      throw new NotFoundException('You are not following this user');
    }

    await this.prisma.follow.delete({
      where: {
        followerId_followingId: { followerId, followingId },
      },
    });

    return { message: 'Successfully unfollowed user' };
  }

  async acceptFollowRequest(userId: string, followerId: string) {
    const isBlocked = await this.blocksService.isBlocked(userId, followerId);
    if (isBlocked) {
      throw new ForbiddenException('Cannot accept follow request from a blocked user');
    }

    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId: userId },
      },
    });

    if (!follow || follow.status !== 'PENDING') {
      throw new NotFoundException('Pending follow request not found');
    }

    const updated = await this.prisma.follow.update({
      where: { id: follow.id },
      data: { status: 'ACCEPTED' },
    });

    await this.notificationsService.createNotification(
      followerId,
      userId,
      NotificationType.FOLLOW_ACCEPT,
      updated.id,
    );

    return { message: 'Follow request accepted', follow: updated };
  }

  async rejectFollowRequest(userId: string, followerId: string) {
    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId: userId },
      },
    });

    if (!follow || follow.status !== 'PENDING') {
      throw new NotFoundException('Pending follow request not found');
    }

    await this.prisma.follow.delete({
      where: { id: follow.id },
    });

    return { message: 'Follow request rejected' };
  }

  async getFollowers(
    targetUserId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<any>> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;

    const blockedIds = await this.blocksService.getBlockedUserIds(targetUserId);

    const where: any = { followingId: targetUserId, status: 'ACCEPTED' as const };
    if (blockedIds.length > 0) {
      where.followerId = { notIn: blockedIds };
    }

    const [total, data] = await Promise.all([
      this.prisma.follow.count({ where }),
      this.prisma.follow.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          follower: {
            select: {
              id: true,
              username: true,
              bio: true,
              avatarUrl: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: data.map((f) => f.follower),
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

  async getFollowing(
    targetUserId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<any>> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;

    const blockedIds = await this.blocksService.getBlockedUserIds(targetUserId);

    const where: any = { followerId: targetUserId, status: 'ACCEPTED' as const };
    if (blockedIds.length > 0) {
      where.followingId = { notIn: blockedIds };
    }

    const [total, data] = await Promise.all([
      this.prisma.follow.count({ where }),
      this.prisma.follow.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          following: {
            select: {
              id: true,
              username: true,
              bio: true,
              avatarUrl: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: data.map((f) => f.following),
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

  async getPendingRequests(
    userId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<any>> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;

    const blockedIds = await this.blocksService.getBlockedUserIds(userId);

    const where: any = { followingId: userId, status: 'PENDING' as const };
    if (blockedIds.length > 0) {
      where.followerId = { notIn: blockedIds };
    }

    const [total, data] = await Promise.all([
      this.prisma.follow.count({ where }),
      this.prisma.follow.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          follower: {
            select: {
              id: true,
              username: true,
              bio: true,
              avatarUrl: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: data.map((f) => ({
        followId: f.id,
        createdAt: f.createdAt,
        follower: f.follower,
      })),
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
}
