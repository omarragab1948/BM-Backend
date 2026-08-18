import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { CloudinaryService } from "../cloudinary/cloudinary.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import {
  PaginationQueryDto,
  PaginatedResult,
} from "../common/dto/pagination.dto";

import { EventsGateway } from "../events/events.gateway";
import { BlocksService } from "../blocks/blocks.service";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly blocksService: BlocksService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async getProfile(username: string, requestingUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        bio: true,
        avatarUrl: true,
        isPrivate: true,
        createdAt: true,
        _count: {
          select: {
            followers: { where: { status: "ACCEPTED" } },
            following: { where: { status: "ACCEPTED" } },
            posts: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (requestingUserId && requestingUserId !== user.id) {
      const isBlocked = await this.blocksService.isBlocked(requestingUserId, user.id);
      if (isBlocked) {
        throw new ForbiddenException("Access denied due to user block");
      }
    }

    let isFollowing = false;
    let followStatus: string | null = null;

    if (requestingUserId) {
      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: requestingUserId,
            followingId: user.id,
          },
        },
      });
      if (follow) {
        isFollowing = follow.status === "ACCEPTED";
        followStatus = follow.status;
      }
    }

    const isSelf = requestingUserId === user.id;
    const canAccessPosts = !user.isPrivate || isSelf || isFollowing;

    return {
      user: {
        ...user,
        followersCount: user._count.followers,
        followingCount: user._count.following,
        postsCount: user._count.posts,
      },
      isSelf,
      isFollowing,
      followStatus,
      canAccessPosts,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    file?: Express.Multer.File,
  ) {
    let avatarUrl: string | undefined = undefined;

    if (file) {
      const uploadResult = await this.cloudinary.uploadFile(file, "avatars");
      avatarUrl = uploadResult.secure_url;
    }

    if (dto.username) {
      const existing = await this.prisma.user.findFirst({
        where: { username: dto.username, NOT: { id: userId } },
      });
      if (existing) {
        throw new BadRequestException("Username is already taken");
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.username && { username: dto.username }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.isPrivate !== undefined && { isPrivate: dto.isPrivate }),
        ...(avatarUrl && { avatarUrl }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        bio: true,
        avatarUrl: true,
        isPrivate: true,
        updatedAt: true,
      },
    });

    if (dto.isPrivate !== undefined) {
      const followers = await this.prisma.follow.findMany({
        where: { followingId: userId, status: "ACCEPTED" },
        select: { followerId: true },
      });
      const followerIds = followers.map((f) => f.followerId);
      this.eventsGateway.emitPrivacyChanged(userId, updatedUser.isPrivate, followerIds);
    }

    return updatedUser;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new BadRequestException(
        "Cannot change password for OAuth account without password",
      );
    }

    const isMatch = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isMatch) {
      throw new BadRequestException("Current password is incorrect");
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.newPassword, salt);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: "Password changed successfully" };
  }

  async searchUsers(
    query: string,
    pagination: PaginationQueryDto,
    currentUserId?: string,
  ): Promise<PaginatedResult<any>> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;

    const blockedIds = currentUserId
      ? await this.blocksService.getBlockedUserIds(currentUserId)
      : [];
    const excludedIds = currentUserId
      ? [...blockedIds, currentUserId]
      : [];

    const whereCondition: any = query
      ? { username: { contains: query, mode: "insensitive" as const } }
      : {};

    if (excludedIds.length > 0) {
      whereCondition.id = { notIn: excludedIds };
    }

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where: whereCondition }),
      this.prisma.user.findMany({
        where: whereCondition,
        skip,
        take: limit,
        select: {
          id: true,
          username: true,
          bio: true,
          avatarUrl: true,
          isPrivate: true,
        },
        orderBy: { username: "asc" },
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
}
