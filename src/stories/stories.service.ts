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
import { CreateStoryDto } from './dto/create-story.dto';
import { NotificationType } from '@prisma/client';

@Injectable()
export class StoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly eventsGateway: EventsGateway,
    private readonly blocksService: BlocksService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createStory(
    userId: string,
    dto: CreateStoryDto,
    file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('A media file (image or video) is required for a story');
    }

    const uploadResult = await this.cloudinary.uploadFile(file, 'stories');
    const mediaType = uploadResult.resource_type === 'video' ? 'VIDEO' : 'IMAGE';
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const story = await this.prisma.story.create({
      data: {
        userId,
        mediaUrl: uploadResult.secure_url,
        mediaType,
        caption: dto.caption,
        expiresAt,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: { views: true },
        },
      },
    });

    const followers = await this.prisma.follow.findMany({
      where: { followingId: userId, status: 'ACCEPTED' },
      select: { followerId: true },
    });

    const blockedIds = await this.blocksService.getBlockedUserIds(userId);
    const followerIds = followers
      .map((f) => f.followerId)
      .filter((id) => !blockedIds.includes(id));

    this.eventsGateway.emitStoryCreated(userId, story, followerIds);

    return story;
  }

  async getStoriesFeed(userId: string) {
    const blockedIds = await this.blocksService.getBlockedUserIds(userId);

    const following = await this.prisma.follow.findMany({
      where: { followerId: userId, status: 'ACCEPTED' },
      select: { followingId: true },
    });

    const targetUserIds = [userId, ...following.map((f) => f.followingId)].filter(
      (id) => !blockedIds.includes(id),
    );

    const now = new Date();

    const stories = await this.prisma.story.findMany({
      where: {
        userId: { in: targetUserIds },
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        views: {
          where: { viewerId: userId },
          select: { id: true },
        },
        _count: {
          select: { views: true },
        },
      },
    });

    const grouped = new Map<string, any>();

    for (const story of stories) {
      const u = story.user;
      if (!grouped.has(u.id)) {
        grouped.set(u.id, {
          user: u,
          stories: [],
          allViewed: true,
        });
      }

      const item = grouped.get(u.id);
      const isViewed = story.views.length > 0;
      item.stories.push({
        ...story,
        isViewed,
        viewsCount: story._count.views,
      });

      if (!isViewed) {
        item.allViewed = false;
      }
    }

    return Array.from(grouped.values());
  }

  async getUserStories(targetUserId: string, requestingUserId: string) {
    const isSelf = requestingUserId === targetUserId;

    if (!isSelf) {
      const isBlocked = await this.blocksService.isBlocked(requestingUserId, targetUserId);
      if (isBlocked) {
        throw new ForbiddenException('Cannot view stories of a blocked user');
      }

      const targetUser = await this.prisma.user.findUnique({
        where: { id: targetUserId },
      });

      if (!targetUser) {
        throw new NotFoundException('User not found');
      }

      if (targetUser.isPrivate) {
        const follow = await this.prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: requestingUserId,
              followingId: targetUserId,
            },
          },
        });
        if (follow?.status !== 'ACCEPTED') {
          throw new ForbiddenException('This profile is private. Follow to view stories.');
        }
      }
    }

    const now = new Date();

    const stories = await this.prisma.story.findMany({
      where: {
        userId: targetUserId,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        views: {
          where: { viewerId: requestingUserId },
          select: { id: true },
        },
        _count: {
          select: { views: true },
        },
      },
    });

    return stories.map((s) => ({
      ...s,
      isViewed: s.views.length > 0,
      viewsCount: s._count.views,
    }));
  }

  async viewStory(storyId: string, viewerId: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.expiresAt < new Date()) {
      throw new BadRequestException('Story has expired');
    }

    if (story.userId !== viewerId) {
      const isBlocked = await this.blocksService.isBlocked(viewerId, story.userId);
      if (isBlocked) {
        throw new ForbiddenException('Cannot view story of a blocked user');
      }
    }

    const existingView = await this.prisma.storyView.findUnique({
      where: {
        storyId_viewerId: { storyId, viewerId },
      },
    });

    if (!existingView) {
      await this.prisma.storyView.create({
        data: {
          storyId,
          viewerId,
        },
      });

      if (story.userId !== viewerId) {
        await this.notificationsService.createNotification(
          story.userId,
          viewerId,
          NotificationType.STORY_VIEW,
          storyId,
        );
      }

      const [viewerUser, viewsCount] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: viewerId },
          select: { id: true, username: true, avatarUrl: true, bio: true },
        }),
        this.prisma.storyView.count({ where: { storyId } }),
      ]);

      if (viewerUser) {
        this.eventsGateway.emitStoryViewed(story.userId, {
          storyId,
          viewer: {
            id: viewerUser.id,
            username: viewerUser.username,
            avatarUrl: viewerUser.avatarUrl,
            bio: viewerUser.bio,
            viewedAt: new Date().toISOString(),
          },
          viewsCount,
        });
      }
    }

    return { message: 'Story viewed successfully' };
  }

  async getStoryViewers(storyId: string, ownerId: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.userId !== ownerId) {
      throw new ForbiddenException('You can only view viewers of your own story');
    }

    const views = await this.prisma.storyView.findMany({
      where: { storyId },
      orderBy: { viewedAt: 'desc' },
      include: {
        viewer: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            bio: true,
          },
        },
      },
    });

    return views.map((v) => ({
      id: v.viewer.id,
      username: v.viewer.username,
      avatarUrl: v.viewer.avatarUrl,
      bio: v.viewer.bio,
      viewedAt: v.viewedAt,
    }));
  }

  async deleteStory(storyId: string, userId: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.userId !== userId) {
      throw new ForbiddenException('You can only delete your own stories');
    }

    const followers = await this.prisma.follow.findMany({
      where: { followingId: userId, status: 'ACCEPTED' },
      select: { followerId: true },
    });

    await this.prisma.story.delete({
      where: { id: storyId },
    });

    const followerIds = followers.map((f) => f.followerId);
    this.eventsGateway.emitStoryDeleted(storyId, followerIds);

    return { message: 'Story deleted successfully' };
  }
}
