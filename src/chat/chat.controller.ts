import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
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
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('messages')
  @UseInterceptors(FileInterceptor('media'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Send a direct message to a user' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['recipientId', 'content'],
      properties: {
        recipientId: { type: 'string', example: 'recipient_user_uuid' },
        content: { type: 'string', example: 'Hello, how are you?' },
        media: { type: 'string', format: 'binary', description: 'Optional media file attachment' },
      },
    },
  })
  sendMessage(
    @GetUser('id') senderId: string,
    @Body() dto: SendMessageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.chatService.sendMessage(senderId, dto, file);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get list of direct message conversations for current user' })
  getConversations(@GetUser('id') userId: string) {
    return this.chatService.getConversations(userId);
  }

  @Get('messages/:recipientId')
  @ApiOperation({ summary: 'Get message history with a specific user (paginated)' })
  getMessages(
    @GetUser('id') userId: string,
    @Param('recipientId') recipientId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.chatService.getMessages(userId, recipientId, pagination);
  }

  @Patch('read/:conversationId')
  @ApiOperation({ summary: 'Mark conversation as read' })
  markAsRead(
    @GetUser('id') userId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.chatService.markConversationAsRead(userId, conversationId);
  }
}
