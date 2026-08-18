import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FilesInterceptor('media', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new post with image and video media uploads' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Post description or caption',
          example: 'Check out my new video and photos!',
        },
        media: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Media files (images or videos) to upload (up to 10 files)',
        },
      },
      required: ['media'],
    },
  })
  createPost(
    @GetUser('id') authorId: string,
    @Body() dto: CreatePostDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.postsService.createPost(authorId, dto, files);
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get personalized activity feed of posts from followed users (paginated)' })
  getFeed(
    @GetUser('id') userId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.postsService.getFeed(userId, pagination);
  }

  @Get('user/:username')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get posts published by a specific user (paginated)' })
  getUserPosts(
    @Param('username') username: string,
    @GetUser('id') requestingUserId: string | undefined,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.postsService.getUserPosts(username, requestingUserId, pagination);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single post details by ID' })
  getPostById(
    @Param('id') postId: string,
    @GetUser('id') requestingUserId?: string,
  ) {
    return this.postsService.getPostById(postId, requestingUserId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a post owned by the current user' })
  deletePost(@Param('id') postId: string, @GetUser('id') userId: string) {
    return this.postsService.deletePost(postId, userId);
  }
}
