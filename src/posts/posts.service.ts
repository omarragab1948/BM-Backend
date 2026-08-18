import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PaginationQueryDto, PaginatedResult } from '../common/dto/pagination.dto';

import { EventsGateway } from '../events/events.gateway';
import { BlocksService } from '../blocks/blocks.service';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly blocksService: BlocksService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async createPost(
    authorId: string,
    dto: CreatePostDto,
    files?: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one media file (image or video) is required');
    }

    const uploadPromises = files.map((file) => this.cloudinary.uploadFile(file, 'posts'));
    const uploadResults = await Promise.all(uploadPromises);

    const post = await this.prisma.post.create({
      data: {
        authorId,
        description: dto.description,
        media: {
          create: uploadResults.map((result, index) => ({
            url: result.secure_url,
            type: result.resource_type === 'video' ? 'VIDEO' : 'IMAGE',
            order: index,
          })),
        },
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        media: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    const followers = await this.prisma.follow.findMany({
      where: { followingId: authorId, status: 'ACCEPTED' },
      select: { followerId: true },
    });

    const blockedIds = await this.blocksService.getBlockedUserIds(authorId);
    const followerIds = followers
      .map((f) => f.followerId)
      .filter((id) => !blockedIds.includes(id));

    this.eventsGateway.broadcastNewPostToFollowers(
      authorId,
      {
        postId: post.id,
        authorId: post.author.id,
        username: post.author.username,
        avatarUrl: post.author.avatarUrl,
        createdAt: post.createdAt,
      },
      followerIds,
    );

    return post;
  }

  async getFeed(
    userId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<any>> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;

    const blockedUserIds = await this.blocksService.getBlockedUserIds(userId);

    const following = await this.prisma.follow.findMany({
      where: { followerId: userId, status: 'ACCEPTED' },
      select: { followingId: true },
    });

    const followingIds = following.map((f) => f.followingId);
    const rawAuthorIds = [...followingIds, userId];
    const authorIds = rawAuthorIds.filter((id) => !blockedUserIds.includes(id));

    const where = { authorId: { in: authorIds } };

    const [total, posts] = await Promise.all([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          media: {
            orderBy: { order: 'asc' },
          },
          likes: {
            where: { userId },
            select: { id: true },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const formattedPosts = posts.map((post) => ({
      ...post,
      isLiked: post.likes.length > 0,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
    }));

    return {
      data: formattedPosts,
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

  async getUserPosts(
    targetUsername: string,
    requestingUserId: string | undefined,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<any>> {
    const targetUser = await this.prisma.user.findUnique({
      where: { username: targetUsername },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const isSelf = requestingUserId === targetUser.id;

    if (requestingUserId && !isSelf) {
      const isBlocked = await this.blocksService.isBlocked(requestingUserId, targetUser.id);
      if (isBlocked) {
        throw new ForbiddenException('Cannot view posts of a blocked user');
      }
    }

    let isFollowing = false;

    if (requestingUserId && !isSelf) {
      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: requestingUserId,
            followingId: targetUser.id,
          },
        },
      });
      isFollowing = follow?.status === 'ACCEPTED';
    }

    if (targetUser.isPrivate && !isSelf && !isFollowing) {
      throw new ForbiddenException('This profile is private. Follow to view posts.');
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;

    const where = { authorId: targetUser.id };

    const [total, posts] = await Promise.all([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          media: {
            orderBy: { order: 'asc' },
          },
          ...(requestingUserId && {
            likes: {
              where: { userId: requestingUserId },
              select: { id: true },
            },
          }),
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const formattedPosts = posts.map((post) => ({
      ...post,
      isLiked: requestingUserId ? post.likes?.length > 0 : false,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
    }));

    return {
      data: formattedPosts,
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

  async getPostById(postId: string, requestingUserId?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            isPrivate: true,
          },
        },
        media: {
          orderBy: { order: 'asc' },
        },
        ...(requestingUserId && {
          likes: {
            where: { userId: requestingUserId },
            select: { id: true },
          },
        }),
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (requestingUserId && requestingUserId !== post.author.id) {
      const isBlocked = await this.blocksService.isBlocked(requestingUserId, post.author.id);
      if (isBlocked) {
        throw new ForbiddenException('Cannot view post of a blocked user');
      }
    }

    if (post.author.isPrivate && requestingUserId !== post.author.id) {
      const follow = requestingUserId
        ? await this.prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: requestingUserId,
                followingId: post.author.id,
              },
            },
          })
        : null;

      if (!follow || follow.status !== 'ACCEPTED') {
        throw new ForbiddenException('This post belongs to a private profile.');
      }
    }

    return {
      ...post,
      isLiked: requestingUserId ? post.likes?.length > 0 : false,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
    };
  }

  async deletePost(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.prisma.post.delete({
      where: { id: postId },
    });

    return { message: 'Post deleted successfully' };
  }
}
