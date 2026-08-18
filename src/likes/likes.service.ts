import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  PaginationQueryDto,
  PaginatedResult,
} from "../common/dto/pagination.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType } from "@prisma/client";
import { BlocksService } from "../blocks/blocks.service";

@Injectable()
export class LikesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocksService: BlocksService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async likePost(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException("Post not found");
    }

    if (userId !== post.authorId) {
      const isBlocked = await this.blocksService.isBlocked(userId, post.authorId);
      if (isBlocked) {
        throw new ForbiddenException("Cannot like post of a blocked user");
      }
    }

    const existingLike = await this.prisma.like.findUnique({
      where: {
        userId_postId: { userId, postId },
      },
    });

    if (existingLike) {
      throw new BadRequestException("You have already liked this post");
    }

    const like = await this.prisma.like.create({
      data: { userId, postId },
    });

    if (userId !== post.authorId) {
      await this.notificationsService.createNotification(
        post.authorId,
        userId,
        NotificationType.LIKE,
        postId,
      );
    }

    return { message: "Post liked", like };
  }

  async unlikePost(userId: string, postId: string) {
    const existingLike = await this.prisma.like.findUnique({
      where: {
        userId_postId: { userId, postId },
      },
    });

    if (!existingLike) {
      throw new NotFoundException("Like not found");
    }

    await this.prisma.like.delete({
      where: {
        userId_postId: { userId, postId },
      },
    });

    return { message: "Post unliked" };
  }

  async getPostLikes(
    postId: string,
    pagination: PaginationQueryDto,
    requestingUserId?: string,
  ): Promise<PaginatedResult<any>> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;

    const blockedIds = requestingUserId
      ? await this.blocksService.getBlockedUserIds(requestingUserId)
      : [];

    const where: any = { postId };
    if (blockedIds.length > 0) {
      where.userId = { notIn: blockedIds };
    }

    const [total, data] = await Promise.all([
      this.prisma.like.count({ where }),
      this.prisma.like.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          user: {
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
      data: data.map((l) => l.user),
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
