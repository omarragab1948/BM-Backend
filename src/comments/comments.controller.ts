import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@ApiTags('Comments')
@Controller('posts/:postId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a comment to a post' })
  createComment(
    @GetUser('id') userId: string,
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createComment(userId, postId, dto);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of comments for a post (paginated)' })
  getComments(
    @Param('postId') postId: string,
    @Query() pagination: PaginationQueryDto,
    @GetUser('id') requestingUserId?: string,
  ) {
    return this.commentsService.getPostComments(postId, pagination, requestingUserId);
  }

  @Delete(':commentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a comment by ID' })
  deleteComment(
    @GetUser('id') userId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.commentsService.deleteComment(commentId, userId);
  }
}
