import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { StoriesService } from './stories.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@ApiTags('Stories')
@Controller('stories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('media'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new 24-hour story' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        caption: { type: 'string', example: 'Sunset at the beach!' },
        media: { type: 'string', format: 'binary', description: 'Story image or video file' },
      },
    },
  })
  createStory(
    @GetUser('id') userId: string,
    @Body() dto: CreateStoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.storiesService.createStory(userId, dto, file);
  }

  @Get('feed')
  @ApiOperation({ summary: 'Get active stories feed for followed users & self' })
  getStoriesFeed(@GetUser('id') userId: string) {
    return this.storiesService.getStoriesFeed(userId);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get active stories for a specific user' })
  getUserStories(
    @Param('userId') targetUserId: string,
    @GetUser('id') requestingUserId: string,
  ) {
    return this.storiesService.getUserStories(targetUserId, requestingUserId);
  }

  @Post(':id/view')
  @ApiOperation({ summary: 'Record story view' })
  viewStory(@Param('id') storyId: string, @GetUser('id') viewerId: string) {
    return this.storiesService.viewStory(storyId, viewerId);
  }

  @Get(':id/viewers')
  @ApiOperation({ summary: 'Get list of viewers for a story (story owner only)' })
  getStoryViewers(@Param('id') storyId: string, @GetUser('id') ownerId: string) {
    return this.storiesService.getStoryViewers(storyId, ownerId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete own story' })
  deleteStory(@Param('id') storyId: string, @GetUser('id') userId: string) {
    return this.storiesService.deleteStory(storyId, userId);
  }
}
