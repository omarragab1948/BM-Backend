import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@ApiTags('Follows')
@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post(':userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow a user' })
  followUser(@GetUser('id') followerId: string, @Param('userId') followingId: string) {
    return this.followsService.followUser(followerId, followingId);
  }

  @Delete(':userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfollow a user' })
  unfollowUser(@GetUser('id') followerId: string, @Param('userId') followingId: string) {
    return this.followsService.unfollowUser(followerId, followingId);
  }

  @Post(':followerId/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept a pending follow request (for private accounts)' })
  acceptRequest(@GetUser('id') userId: string, @Param('followerId') followerId: string) {
    return this.followsService.acceptFollowRequest(userId, followerId);
  }

  @Post(':followerId/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a pending follow request' })
  rejectRequest(@GetUser('id') userId: string, @Param('followerId') followerId: string) {
    return this.followsService.rejectFollowRequest(userId, followerId);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get incoming pending follow requests for the authenticated user (paginated)' })
  getPendingRequests(
    @GetUser('id') userId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.followsService.getPendingRequests(userId, pagination);
  }

  @Get(':userId/followers')
  @ApiOperation({ summary: 'Get list of followers for a user (paginated)' })
  getFollowers(
    @Param('userId') userId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.followsService.getFollowers(userId, pagination);
  }

  @Get(':userId/following')
  @ApiOperation({ summary: 'Get list of users followed by a user (paginated)' })
  getFollowing(
    @Param('userId') userId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.followsService.getFollowing(userId, pagination);
  }
}
