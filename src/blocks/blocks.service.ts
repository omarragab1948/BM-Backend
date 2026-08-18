import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

import { EventsGateway } from "../events/events.gateway";

@Injectable()
export class BlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}
  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new NotFoundException("You cannot blcok yourself");
    }
    const targetUser = await this.prisma.user.findUnique({
      where: {
        id: blockedId,
      },
    });
    if (!targetUser) {
      throw new NotFoundException("User to block not found");
    }
    const existingBlock = await this.prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
    });
    if (existingBlock) {
      throw new BadRequestException("You already blocked this user");
    }

    const block = await this.prisma.block.create({
      data: {
        blockerId,
        blockedId,
      },
    });

    await this.prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: blockerId, followingId: blockedId },
          {
            followerId: blockedId,
            followingId: blockerId,
          },
        ],
      },
    });

    this.eventsGateway.emitUserBlocked(blockerId, blockedId);

    return {
      message: "Successfully blocked user",
      block,
    };
  }
  async unblockUser(blockerId: string, blockedId: string) {
    const block = await this.prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
    });
    if (!block) {
      throw new NotFoundException("Block not found");
    }
    await this.prisma.block.delete({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
    });

    this.eventsGateway.emitUserUnblocked(blockerId, blockedId);

    return {
      message: "Successfully unblocked user",
    };
  }
  async getBlockedUsers(userId:string) {
    return await this.prisma.block.findMany({
        where:{
            blockerId:userId
        },
        select:{
            id:true,
            blockerId:true,
            blockedId:true,
            createdAt:true,
            blocked:{
                select:{
                    id:true,
                    avatarUrl:true,
                    username:true,
                }
            }
        },

        orderBy:{
            createdAt:"desc"
        }
    })
  }
  async isBlocked(userAId: string, userBId: string): Promise<boolean> {
    if (!userAId || !userBId || userAId === userBId) return false;
    const count = await this.prisma.block.count({
      where: {
        OR: [
          { blockerId: userAId, blockedId: userBId },
          { blockerId: userBId, blockedId: userAId },
        ],
      },
    });
    return count > 0;
  }

  async getBlockedUserIds(userId: string): Promise<string[]> {
    if (!userId) return [];
    const blocks = await this.prisma.block.findMany({
      where: {
        OR: [
          { blockerId: userId },
          { blockedId: userId },
        ],
      },
      select: {
        blockerId: true,
        blockedId: true,
      },
    });

    const ids = new Set<string>();
    for (const b of blocks) {
      if (b.blockerId !== userId) ids.add(b.blockerId);
      if (b.blockedId !== userId) ids.add(b.blockedId);
    }
    return Array.from(ids);
  }
}
