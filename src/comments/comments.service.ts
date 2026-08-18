import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { PaginationQueryDto, PaginatedResult } from '../common/dto/pagination.dto';

import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';
import { BlocksService } from '../blocks/blocks.service';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocksService: BlocksService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createComment(userId: string, postId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (userId !== post.authorId) {
      const isBlocked = await this.blocksService.isBlocked(userId, post.authorId);
      if (isBlocked) {
        throw new ForbiddenException('Cannot comment on post of a blocked user');
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        userId,
        postId,
        content: dto.content,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (userId !== post.authorId) {
      await this.notificationsService.createNotification(
        post.authorId,
        userId,
        NotificationType.COMMENT,
        comment.id,
      );
    }

    return comment;
  }

  async getPostComments(
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
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
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

  async deleteComment(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.comment.delete({
      where: { id: commentId },
    });

    return { message: 'Comment deleted successfully' };
  }
}
