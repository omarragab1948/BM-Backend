import {
  Controller,
  Get,
  Patch,
  Post,
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
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SearchUsersQueryDto } from './dto/search-users.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('search')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search users by username with pagination' })
  searchUsers(
    @Query() queryDto: SearchUsersQueryDto,
    @GetUser('id') currentUserId?: string,
  ) {
    return this.usersService.searchUsers(queryDto.q || '', queryDto, currentUserId);
  }

  @Get('profile/:username')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile by username' })
  getProfile(
    @Param('username') username: string,
    @GetUser('id') requestingUserId?: string,
  ) {
    return this.usersService.getProfile(username, requestingUserId);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update current user profile and avatar' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          example: 'johndoe_updated',
        },
        bio: {
          type: 'string',
          example: 'Software engineer and media enthusiast',
        },
        isPrivate: {
          type: 'boolean',
          example: false,
        },
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image file to upload',
        },
      },
    },
  })
  updateProfile(
    @GetUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.usersService.updateProfile(userId, dto, file);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password' })
  changePassword(
    @GetUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(userId, dto);
  }
}
