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
import { LikesService } from './likes.service';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@ApiTags('Likes')
@Controller('posts/:postId/likes')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like a post' })
  likePost(@GetUser('id') userId: string, @Param('postId') postId: string) {
    return this.likesService.likePost(userId, postId);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlike a post' })
  unlikePost(@GetUser('id') userId: string, @Param('postId') postId: string) {
    return this.likesService.unlikePost(userId, postId);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of users who liked a post (paginated)' })
  getLikes(
    @Param('postId') postId: string,
    @Query() pagination: PaginationQueryDto,
    @GetUser('id') requestingUserId?: string,
  ) {
    return this.likesService.getPostLikes(postId, pagination, requestingUserId);
  }
}
